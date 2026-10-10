import { ApiFailure } from './gemini.js';

/**
 * Per-client budget for calls that actually spend AI money. Cache hits and built-in recipes never
 * consume budget. State is per process/isolate, so this is defense-in-depth: also add an edge rate-limit
 * rule (e.g. Cloudflare) in front of /api/*.
 *
 * Costs used by the routes: text call = 1, extra foundry search = 2, vision = 3, sprite = 5.
 * Default budget is 120 units per minute per client; override with AI_BUDGET_PER_MINUTE.
 */
type HeaderBag = Record<string, string | string[] | undefined>;

const WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 5_000;
const windows = new Map<string, { used: number; resetAt: number }>();

/**
 * Best-effort client identity. cf-connecting-ip is set by Cloudflare; x-real-ip / x-forwarded-for are set by
 * Vercel and most proxies. These headers are spoofable if the server is exposed directly, so don't treat
 * this as authentication.
 */
export function clientId(req: { headers: HeaderBag; socket?: { remoteAddress?: string } }): string {
  const first = (name: string) => {
    const value = req.headers[name];
    return (Array.isArray(value) ? value[0] : value)?.split(',')[0].trim();
  };
  return first('cf-connecting-ip') || first('x-real-ip') || first('x-forwarded-for') || req.socket?.remoteAddress || 'unknown';
}

export function takeAiBudget(client: string, cost = 1, now = Date.now()): void {
  const limit = Number(process.env.AI_BUDGET_PER_MINUTE) || 120;

  if (windows.size >= MAX_TRACKED_CLIENTS) {
    for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
    // Still full: drop the oldest entries (Map preserves insertion order).
    for (const key of windows.keys()) {
      if (windows.size < MAX_TRACKED_CLIENTS) break;
      windows.delete(key);
    }
  }

  let entry = windows.get(client);
  if (!entry || entry.resetAt <= now) {
    entry = { used: 0, resetAt: now + WINDOW_MS };
    windows.set(client, entry);
  }
  if (entry.used + cost > limit) {
    throw new ApiFailure(429, 'Too many requests. Please wait a moment and try again.');
  }
  entry.used += cost;
}

/** For tests. */
export function resetAiBudgets(): void {
  windows.clear();
}
