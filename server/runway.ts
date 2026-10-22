/**
 * Optional Runway Dev image fallback.
 * Uses only RUNWAYML_API_SECRET stored server-side (Cloudflare Secret).
 * Runway generates tasks asynchronously. Persist task IDs in the existing
 * Cloudflare KV so retries POLL an existing paid task, never create a fresh
 * image for each browser poll. One Muse Image = 1 Runway credit.
 *
 * Docs: https://docs.dev.runwayml.com/guides/using-the-api/
 */
import { createHash } from 'node:crypto';
import { getPersistentCacheBinding } from './cacheBinding.js';
import type { GeminiImageResult } from './gemini.js';

export const RUNWAY_SPRITE_MODEL = 'muse_image';
export const RUNWAY_API_URL = 'https://api.dev.runwayml.com/v1';
const TASK_TTL = 60 * 60 * 24 * 2;
const TASK_LIMIT_MS = 60 * 60 * 24;
const MAX_BYTES = 12_000_000;
const KEY_PREFIX = 'boop-runway-sprite-v1:';
type Job = { id: string; at: number; state?: 'pending' | 'failed' };
export class RunwayPendingError extends Error {
  constructor() { super('Runway artwork is rendering. Your discovery is saved; retry artwork shortly.'); this.name='RunwayPendingError'; }
}
type ApiTask = { id?: unknown; status?: unknown; output?: unknown };
export function runwayJobKey(prompt: string): string {
  return KEY_PREFIX + createHash('sha256').update(RUNWAY_SPRITE_MODEL+'\0'+prompt).digest('hex');
}
function runwayOutputHostAllowed(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && (
      url.hostname.endsWith('.cloudfront.net') ||
      url.hostname === 'runwayml.com' || url.hostname.endsWith('.runwayml.com') ||
      url.hostname === 'runway.com' || url.hostname.endsWith('.runway.com')
    );
  } catch { return false; }
}
const inFlight = new Map<string, Promise<GeminiImageResult | null>>();
export async function generateRunwaySprite(prompt: string, options: {
  apiKey?: string; fetcher?: typeof fetch; kv?: { get(key: string, type?: 'json'): Promise<any>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> };
  enabled?: boolean;
} = {}): Promise<GeminiImageResult | null> {
  const key = (options.apiKey ?? process.env.RUNWAYML_API_SECRET ?? '').trim();
  const enabled = options.enabled ?? process.env.RUNWAY_SPRITES_ENABLED === '1';
  if (!enabled || !key) return null;
  // No KV = no safe protection against duplicate paid jobs across Worker isolates.
  const kv = options.kv ?? getPersistentCacheBinding();
  if (!kv) { console.warn('Runway sprite generation requires QUARKPOP_CACHE KV for task deduplication.'); return null; }
  const jobKey = runwayJobKey(prompt);
  const existing = inFlight.get(jobKey);
  if (existing) return existing;
  const promise = runSprite(prompt,key,jobKey,kv,options.fetcher||fetch);
  inFlight.set(jobKey,promise);
  try { return await promise; }
  finally { if (inFlight.get(jobKey)===promise) inFlight.delete(jobKey); }
}
async function runSprite(
  prompt: string, apiKey: string, key: string,
  kv: NonNullable<Parameters<typeof generateRunwaySprite>[1]['kv']>,
  fetcher: typeof fetch,
): Promise<GeminiImageResult | null> {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type':'application/json', 'X-Runway-Version':'2024-11-06' };
  let job:Job|null = null;
  try { job = await kv.get(key,'json') as Job|null; }
  catch { return null; /* Never risk duplicate generation if task state is unreadable. */ }

  if (job?.state==='failed' || (job && Date.now()-job.at > TASK_LIMIT_MS)) {
    // Don't re-charge after a failed/expired task. Owner can explicitly reroll.
    return null;
  }
  const request = async(url:string,init:RequestInit) => {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12_000);
    try { return await fetcher(url,{...init,signal:controller.signal,redirect:'error'}); }
    finally {clearTimeout(timer);}
  };
  if (!job) {
    // Runway Muse supports one square image; keep prompts below 4,000 chars.
    // A shortened prompt preserves the main concept, distinctive palette and
    // square magenta backdrop to assist our existing sprite postprocessor.
    const compact = prompt.length>3950 ? prompt.slice(0,3250)+'\nSingle colorful crisp pixel-art item, square magenta background, no text.' : prompt;
    let response:Response;
    try {
      response=await request(RUNWAY_API_URL+'/text_to_image',{method:'POST',headers,
        body:JSON.stringify({model:RUNWAY_SPRITE_MODEL,promptText:compact,ratio:'1024:1024',outputCount:1})});
    }catch {return null;}
    if (!response.ok) {
      console.warn(`Runway image task was not accepted (HTTP ${response.status}).`);
      return null;
    }
    const body=await response.json().catch(()=>null) as ApiTask|null;
    if (!body || typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.id)) return null;
    job={id:body.id,at:Date.now(),state:'pending'};
    try { await kv.put(key,JSON.stringify(job),{expirationTtl:TASK_TTL}); }
    catch {
      // The paid task exists but its ID could not be persisted. Do not
      // silently submit another one; record a visible operational warning.
      console.error('Runway task created but KV tracking failed; do not retry until KV is restored.');
      return null;
    }
    throw new RunwayPendingError();
  }

  let response:Response;
  try { response=await request(RUNWAY_API_URL+'/tasks/'+encodeURIComponent(job.id),{method:'GET',headers}); }
  catch { throw new RunwayPendingError(); }
  if (!response.ok) {
    if (response.status===429 || response.status>=500) throw new RunwayPendingError();
    console.warn(`Runway image status unavailable (HTTP ${response.status}).`);
    return null;
  }
  const task=await response.json().catch(()=>null) as ApiTask|null;
  if (!task || typeof task.status!=='string') throw new RunwayPendingError();
  if (['PENDING','RUNNING','THROTTLED'].includes(task.status)) throw new RunwayPendingError();
  if (task.status==='FAILED' || task.status==='CANCELED') {
    try { await kv.put(key,JSON.stringify({...job,state:'failed'}),{expirationTtl:TASK_TTL}); }catch{}
    return null;
  }
  if (task.status!=='SUCCEEDED') throw new RunwayPendingError();
  const url=Array.isArray(task.output)?task.output[0]:undefined;
  if (typeof url!=='string' || !runwayOutputHostAllowed(url)) return null;
  let image:Response;
  try { image=await request(url,{method:'GET',headers:{Accept:'image/png,image/jpeg,image/webp'}}); }
  catch { throw new RunwayPendingError(); }
  if (!image.ok) return null;
  const mimeType=(image.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if (!['image/png','image/jpeg','image/webp'].includes(mimeType)) return null;
  const bytes=new Uint8Array(await image.arrayBuffer());
  if (bytes.length<100 || bytes.length>MAX_BYTES) return null;
  console.info('Sprite image generated using Runway Muse Image.');
  return {data:Buffer.from(bytes).toString('base64'),mimeType,model:RUNWAY_SPRITE_MODEL};
}
