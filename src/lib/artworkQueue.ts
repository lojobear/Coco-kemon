import { getElementEmoji, retryElementEmoji } from './elementEmoji';
import type { InfiniteElement } from './infiniteCraftData';

/**
 * Best-effort artwork queue for new discoveries. No credits are spent on album
 * previews; discoveries are saved independently of image generation.
 * Browser work resumes while open; Cloudflare Cron also recovers missing art while closed.
 */
export const ARTWORK_QUEUE_KEY = 'boop-artwork-pending-v1';
export const ARTWORK_QUEUE_EVENT = 'boop-artwork-queue-updated';
export const ARTWORK_FAILURE_DELAY_MS = 30 * 60_000;
export function nextArtworkQuotaResetUtc(now = Date.now()): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}
export interface ArtworkTask {
  name: string;
  shiny: boolean;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}
let tasks: ArtworkTask[] | null = null;
let running = false;
let pausedUntil = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let attemptsThisSession = 0;
// A per-session limit stopped all artwork after four attempts, even on long
// sessions. Use a rolling window and automatically resume instead.
export const ARTWORK_RATE_WINDOW_MS = 5 * 60_000;
export const ARTWORK_RATE_MAX_ATTEMPTS = 6;
let attemptsThisWindow = 0;
let windowStartedAt = Date.now();

export function artworkRateLimitDelay(attempts: number, windowStart: number, now: number): number {
  return attempts >= ARTWORK_RATE_MAX_ATTEMPTS
    ? Math.max(0, windowStart + ARTWORK_RATE_WINDOW_MS - now) : 0;
}
function rateLimitDelay(now = Date.now()): number {
  if (now - windowStartedAt >= ARTWORK_RATE_WINDOW_MS) {
    windowStartedAt = now;
    attemptsThisWindow = 0;
  }
  return artworkRateLimitDelay(attemptsThisWindow, windowStartedAt, now);
}

export function parseArtworkTasks(raw: unknown): ArtworkTask[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const valid: ArtworkTask[] = [];
  for (const entry of raw.slice(0, 500)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<ArtworkTask>;
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 160) continue;
    const shiny = item.shiny === true;
    const name = item.name.trim();
    const key = `${shiny ? 'shiny:' : ''}${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ name, shiny,
      attempts: Number.isInteger(item.attempts) ? Math.min(20, Math.max(0, item.attempts!)) : 0,
      nextAttemptAt: Number.isFinite(item.nextAttemptAt) ? Math.max(0, item.nextAttemptAt!) : 0,
      lastError: typeof item.lastError === 'string' ? item.lastError.slice(0, 200) : undefined });
  }
  return valid.slice(0, 400);
}

function readTasks() {
  if (tasks) return tasks;
  try { tasks = parseArtworkTasks(JSON.parse(localStorage.getItem(ARTWORK_QUEUE_KEY) || '[]')); }
  catch { tasks = []; }
  return tasks;
}
function broadcast() {
  try {
    localStorage.setItem(ARTWORK_QUEUE_KEY, JSON.stringify(readTasks()));
    window.dispatchEvent(new Event(ARTWORK_QUEUE_EVENT));
  } catch { /* Browsing remains playable even if local storage is full. */ }
}
/** Read-only view for the Missing Sprites screen. Never silently queue art while browsing. */
export function artworkQueueEntries(): ArtworkTask[] {
  return readTasks().map(entry => ({ ...entry }));
}

export function artworkQueueStatus() {
  const entries=readTasks();
  return { pending: entries.length, running,
    blocked: pausedUntil > Date.now() || rateLimitDelay() > 0,
    failures: entries.filter(x=>x.lastError).length };
}
export function enqueueArtwork(name: string, shiny = false): void {
  const list=readTasks();
  const trimmed=name.trim();
  if (!trimmed || trimmed.length > 160) return;
  if (!list.some(t=>t.shiny===shiny && t.name.toLowerCase()===trimmed.toLowerCase())) {
    // Recently crafted items should not sit behind a backlog of old artwork.
    list.unshift({name:trimmed,shiny,attempts:0,nextAttemptAt:0});
    if(list.length>400) list.pop();
    broadcast();
  }
  void pumpArtworkQueue();
}
/**
 * Manually repair historical discoveries after provider downtime.
 * Reads caches/profile artwork FIRST with generateIfMissing=false, so the scan
 * consumes zero AI credits. Queue at most five missing items per tap.
 */
export async function queueMissingArtwork(elements: readonly InfiniteElement[], maxNew = 5) {
  const wanted = Math.min(5,Math.max(1,Math.floor(maxNew)));
  let checked = 0;
  let queued = 0;
  for (const element of elements) {
    if (checked >= 140 || queued >= wanted) break;
    if (!element?.name?.trim() || element.customSpriteUrl) continue;
    const variants = [false, ...(element.unlockedShiny || element.isShiny ? [true] : [])];
    for (const shiny of variants) {
      if (checked >= 140 || queued >= wanted) break;
      if (readTasks().some(t=>t.shiny===shiny && t.name.toLowerCase()===element.name.toLowerCase())) continue;
      checked++;
      try {
        // Cache/profile only. This NEVER asks a model to generate an image.
        const existing = await getElementEmoji(element.name,false,'',false,shiny);
        if (existing) continue;
      } catch {
        // Storage or account lookup errors are not proof artwork is missing.
        continue;
      }
      enqueueArtwork(element.name,shiny);
      queued++;
    }
  }
  return {checked,queued};
}

function planNext() {
  if (timer) clearTimeout(timer);
  if (running || !readTasks().length || typeof window==='undefined') return;
  const next=Math.max(pausedUntil,Math.min(...readTasks().map(t=>t.nextAttemptAt)),Date.now()+rateLimitDelay());
  // Long timers aren't needed if browser goes to sleep: online/focus also wake us.
  timer=setTimeout(()=>void pumpArtworkQueue(),Math.min(Math.max(1000,next-Date.now()),60_000));
}
export async function pumpArtworkQueue(force=false): Promise<void> {
  if (running || typeof window==='undefined') return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (!force && (pausedUntil>Date.now() || rateLimitDelay()>0)) { planNext(); return; }
  const entry=readTasks().find(x=>force || x.nextAttemptAt<=Date.now());
  if (!entry) { planNext();return; }
  running=true; attemptsThisWindow++;
  broadcast();
  try {
    const result=force ? await retryElementEmoji(entry.name,entry.shiny)
      : await getElementEmoji(entry.name,false,'',true,entry.shiny);
    if (!result) throw new Error('No sprite was generated.');
    tasks=readTasks().filter(x=>x!==entry);
  } catch(error) {
    const message=error instanceof Error?error.message:'Image provider is unavailable.';
    if (/Runway artwork is rendering/i.test(message)) {
      // HTTP 425 means the same paid task is still rendering. Poll that ID,
      // not a fresh generation. This is not a failed/charged retry.
      attemptsThisWindow=Math.max(0,attemptsThisWindow-1);
      entry.lastError=undefined;
      entry.nextAttemptAt=Date.now()+12_000;
    } else {
      entry.attempts++;
      if (/Daily image allowance used up|Cloudflare resets at 00:00 UTC|Boop safe daily image allowance reached|Boop image spending guard/i.test(message)) {
        // All Cloudflare image calls would fail until the next UTC day. Stop
        // hammering providers, but preserve the pending discovery and retry
        // once allocation renews. The user can override after adding billing.
        const resetAt = nextArtworkQuotaResetUtc() + 5_000;
        pausedUntil = Math.max(pausedUntil, resetAt);
        entry.lastError = 'Daily free-image allowance reserved. Artwork will resume after 00:00 UTC without paid overages.';
        entry.nextAttemptAt = resetAt;
      } else {
        // Provider credentials/quota problems affect every task. Do not flood
        // every subsequent discovery with the same expensive failed request.
        const credentialIssue=/runware|quota|allocation|unauthorized|API key|provider|503|429/i.test(message);
        if (credentialIssue) pausedUntil=Date.now()+ARTWORK_FAILURE_DELAY_MS;
        entry.lastError=credentialIssue
          ? 'Artwork providers are temporarily unavailable. Your discovery is saved.'
          : 'Artwork will be retried when the service is available.';
        entry.nextAttemptAt=Date.now()+Math.min(24*60*60_000,ARTWORK_FAILURE_DELAY_MS*Math.max(1,entry.attempts));
      }
    }
  } finally {
    running=false;broadcast();planNext();
  }
  if (!pausedUntil || Date.now()>=pausedUntil) void pumpArtworkQueue();
}
export function retryPendingArtwork(): void {
  pausedUntil=0;
  attemptsThisWindow=0;
  windowStartedAt=Date.now();
  if (timer) clearTimeout(timer);
  for(const entry of readTasks()) { entry.nextAttemptAt=0;entry.lastError=undefined; }
  broadcast();void pumpArtworkQueue();
}
export function startArtworkQueue() {
  const online=()=>void pumpArtworkQueue();
  const focus=()=>{if(document.visibilityState==='visible')void pumpArtworkQueue();};
  window.addEventListener('online',online);
  document.addEventListener('visibilitychange',focus);
  void pumpArtworkQueue();
  return ()=>{window.removeEventListener('online',online);document.removeEventListener('visibilitychange',focus);if(timer) clearTimeout(timer);};
}
