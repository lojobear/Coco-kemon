import type { Express } from 'express';
import { emojiKey } from '../src/lib/emojiGeometry.js';
import { getPersistentCacheBinding } from './cacheBinding.js';
import { cachedWork, readPersistentJson } from './persistentCache.js';
import { generateGeminiImage, publicFailure, ApiFailure, type GeminiImageResult } from './gemini.js';
import { buildSpritePrompt, SPRITE_ENGINE_VERSION } from './emoji.js';
import { clientId, takeAiBudget } from './rateLimit.js';
import { BOOP_DAILY_IMAGE_NEURON_LIMIT, ImageBudgetExceeded, safeImageSpendingEnabled, utcBudgetDay } from './imageSpendingGuard.js';

const PREFIX = 'boop:recovery:v1:';
const CACHE_NAMESPACE = 'element-sprite-v9';
const TASK_LIFETIME = 90 * 86400;
const MAX_BATCH = 40;
const MAX_SCANNED = 3000;
/** Intentionally small batches: free-only image cost is reserved inside generateGeminiImage. */
export const RECOVERY_IMAGES_PER_CRON = 2;
export type RecoveryInput = { name: string; shiny: boolean };
export type RecoveryTask = RecoveryInput & {
  key: string; state: 'pending' | 'retry' | 'ready'; firstSeenAt: number;
  attempts: number; nextAttemptAt: number; lastError?: string;
};
export function recoveryKey(name: string, shiny: boolean): string {
  return `${shiny ? 'shiny:' : ''}${emojiKey(name)}`;
}
const taskKey = (key: string) => PREFIX + encodeURIComponent(key);
export function serverSpriteKey(name: string, shiny: boolean) {
  return `${SPRITE_ENGINE_VERSION}:${recoveryKey(name, shiny)}`;
}
export function normalizeRecoveryInput(v: unknown): RecoveryInput | null {
  if (!v || typeof v !== 'object') return null;
  const obj = v as { name?: unknown; shiny?: unknown };
  if (typeof obj.name !== 'string' || typeof obj.shiny !== 'boolean') return null;
  const name = obj.name.normalize('NFKC').trim().replace(/\s+/g,' ');
  if (!name || name.length > 160 || /[\x00-\x1f]/.test(name)) return null;
  return { name, shiny: obj.shiny };
}
const validImage = (v: unknown): v is GeminiImageResult => {
  const x = v as GeminiImageResult | undefined;
  return Boolean(x && typeof x.data === 'string' && x.data.length > 100 &&
    x.data.length < 16_000_000 && typeof x.mimeType === 'string' &&
    /^image\/(?:png|jpe?g|webp)$/i.test(x.mimeType));
};
export async function findRecoveryArt(name: string, shiny: boolean) {
  const result = await readPersistentJson<GeminiImageResult>(CACHE_NAMESPACE, serverSpriteKey(name, shiny));
  return validImage(result) ? result : null;
}
export async function registerRecoveryBatch(values: unknown) {
  const kv = getPersistentCacheBinding();
  if (!kv?.get || !kv.put) throw new ApiFailure(503, 'Background sprite recovery is temporarily unavailable.');
  if (!Array.isArray(values) || values.length > MAX_BATCH) throw new ApiFailure(400, 'Send up to 40 discoveries per batch.');
  const ready: string[] = [];
  let added = 0, waiting = 0;
  const seen = new Set<string>();
  for (const item of values) {
    const input = normalizeRecoveryInput(item);
    if (!input) continue;
    const key = recoveryKey(input.name, input.shiny);
    if (seen.has(key)) continue;
    seen.add(key);
    // Shared cache also contains images generated while the app was open.
    const art = await findRecoveryArt(input.name, input.shiny);
    if (art) { ready.push(key); continue; }
    const id = taskKey(key);
    const previous = await kv.get(id, 'json') as RecoveryTask | null;
    if (previous && typeof previous.firstSeenAt === 'number') { waiting++; continue; }
    const task: RecoveryTask = { ...input, key, state:'pending',
      firstSeenAt:Date.now(), attempts:0, nextAttemptAt:0 };
    await kv.put(id, JSON.stringify(task), { expirationTtl:TASK_LIFETIME });
    added++;
  }
  return { added, waiting, ready };
}
async function pendingTasks(max = MAX_SCANNED): Promise<RecoveryTask[]> {
  const kv = getPersistentCacheBinding();
  if (!kv?.list || !kv?.get) return [];
  const result: RecoveryTask[] = [];
  let cursor: string | undefined;
  let seen = 0;
  do {
    const page = await kv.list({ prefix:PREFIX, limit: Math.min(1000, max-seen), ...(cursor ? {cursor} : {}) });
    for (const item of page.keys || []) {
      if (++seen > max) break;
      const task = await kv.get(item.name, 'json') as RecoveryTask | null;
      if (task && typeof task.key === 'string' && (task.state === 'pending' || task.state === 'retry'))
        result.push(task);
    }
    cursor = page.list_complete ? undefined : page.cursor;
    if (!page.keys?.length) break;
  } while (cursor && seen < max);
  return result.sort((a,b) => a.firstSeenAt - b.firstSeenAt);
}
async function markTask(task: RecoveryTask): Promise<void> {
  const kv = getPersistentCacheBinding();
  if (!kv?.put) throw new Error('Artwork queue storage unavailable');
  await kv.put(taskKey(task.key), JSON.stringify(task), { expirationTtl:TASK_LIFETIME });
}
export function nextUtcReset(now = Date.now()) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()+1) + 5000;
}
export async function getRecoveryBudget() {
  const kv = getPersistentCacheBinding();
  const record = await kv?.get('boop:image-free-neurons:v1:'+utcBudgetDay(), 'json') as { neurons?: number } | null;
  const used = Math.max(0, Number(record?.neurons) || 0);
  return { used: Math.min(BOOP_DAILY_IMAGE_NEURON_LIMIT, used),
    limit: BOOP_DAILY_IMAGE_NEURON_LIMIT,
    remaining: Math.max(0, BOOP_DAILY_IMAGE_NEURON_LIMIT - used), resetAt:nextUtcReset() };
}
/** Cloudflare Cron handler. Never generate without the existing free-only safety setting and bindings. */
export async function runRecoveryPass(limit = RECOVERY_IMAGES_PER_CRON) {
  if (!safeImageSpendingEnabled()) return { generated:0, ready:0, retries:0, reason:'safe-mode-required' };
  const kv = getPersistentCacheBinding();
  if (!kv?.list || !kv?.get || !kv?.put) return { generated:0, ready:0, retries:0, reason:'storage-unavailable' };
  let generated = 0, ready = 0, retries = 0;
  const now = Date.now();
  const tasks = await pendingTasks();
  for (const task of tasks.filter(x=>x.nextAttemptAt<=now).slice(0, Math.min(3,Math.max(1,limit)))) {
    try {
      if (await findRecoveryArt(task.name, task.shiny)) {
        task.state = 'ready'; task.lastError = undefined;
        await markTask(task); ready++; continue;
      }
      const budget = await getRecoveryBudget();
      // Stop well before the 5,000-neuron guard. Reserve-free-neurons is still
      // called by the image model before EVERY actual inference attempt.
      if (budget.remaining < 150) break;
      const result = await cachedWork<GeminiImageResult>(
        CACHE_NAMESPACE, serverSpriteKey(task.name,task.shiny),
        () => generateGeminiImage(buildSpritePrompt(task.name,'',task.shiny))
      );
      if (!validImage(result.value)) throw new Error('No usable image returned');
      task.state = 'ready'; task.lastError = undefined;
      await markTask(task); ready++;
      if (result.cache === 'miss') generated++;
    } catch(error) {
      if (error instanceof ImageBudgetExceeded) {
        task.state='retry';task.lastError='Daily free allowance reached';
        task.nextAttemptAt=nextUtcReset();await markTask(task);break;
      }
      task.state='retry'; task.attempts=Math.min(20,task.attempts+1);
      task.lastError=error instanceof Error?error.message.slice(0,160):'Generation failed';
      task.nextAttemptAt=now+Math.min(86400000, 30*60000*Math.max(1,task.attempts));
      await markTask(task);retries++;
    }
  }
  return { generated, ready, retries };
}
export function registerSpriteRecoveryRoutes(app: Express) {
  app.post('/api/sprite-recovery/sync', async (req,res) => {
    try {
      takeAiBudget(clientId(req), 4);
      res.json(await registerRecoveryBatch(req.body?.tasks));
    } catch(error) {const e=publicFailure(error);res.status(e.status).json({error:e.error});}
  });
  app.post('/api/sprite-recovery/ready', async (req,res) => {
    try {
      takeAiBudget(clientId(req), 1);
      const items = req.body?.tasks;
      if (!Array.isArray(items) || items.length>MAX_BATCH) throw new ApiFailure(400,'Send up to 40 names.');
      const ready:string[]=[];
      for(const value of items) {
        const item=normalizeRecoveryInput(value);
        if (item && await findRecoveryArt(item.name,item.shiny)) ready.push(recoveryKey(item.name,item.shiny));
      }
      res.json({ready});
    } catch(error){const e=publicFailure(error);res.status(e.status).json({error:e.error});}
  });
  app.get('/api/sprite-recovery/status', async (_req,res) => {
    try {
      const budget=await getRecoveryBudget();
      // Shared public cache, not an individual user's private collection.
      res.json({budget,backgroundEnabled:safeImageSpendingEnabled(),cadenceMinutes:10});
    } catch{res.status(503).json({error:'Recovery status unavailable'});}
  });
}
