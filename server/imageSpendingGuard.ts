import { getPersistentCacheBinding } from './cacheBinding.js';
import { getImageBudgetBinding } from './imageBudgetBinding.js';

/**
 * BOOP SPENDING GUARD
 * Cloudflare's $5 Workers Paid plan is a base charge, not a usage cap.
 * Boop reserves Workers AI neurons atomically through a Durable Object.
 * Paid Gemini/Runware/Runway image fallbacks are blocked in safe mode.
 *
 * The 10,000-neuron app ceiling equals Cloudflare's ACCOUNT-WIDE free
 * allowance, leaving NO headroom for other Workers AI usage. This remains
 * best-effort, NOT a hard billing cap on the Cloudflare account: other
 * Workers, products, taxes and provider billing are outside this ledger.
 */
export const BOOP_DAILY_IMAGE_NEURON_LIMIT = 10_000;
export const FLUX2_KLEIN_512_NEURONS = 26.05;
export const FLUX1_SCHNELL_8STEP_NEURONS = 4.8 + 8 * 9.6;

export function safeImageSpendingEnabled() {
  return process.env.BOOP_SAFE_SPENDING === '1';
}
export function utcBudgetDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}
export class ImageBudgetExceeded extends Error {
  readonly status = 429;
  constructor() {
    super('Boop safe daily image allowance reached. No paid image request was made. Your artwork is queued for the free allowance to reset at 00:00 UTC.');
    this.name = 'ImageBudgetExceeded';
  }
}
type Usage = { allowed?: boolean; used?: number; limit?: number };
function imageLedger() {
  const binding = getImageBudgetBinding();
  if (!binding) throw new ImageBudgetExceeded();
  return binding.get(binding.idFromName('boop-all-image-generation'));
}
async function legacyBudgetFloor(day: string): Promise<number> {
  // Previous deployments counted in KV. Preserve today's balance when rolling
  // over to Durable Objects instead of granting an accidental second allowance.
  const kv = getPersistentCacheBinding();
  if (!kv?.get) throw new ImageBudgetExceeded();
  const record = await kv.get('boop:image-free-neurons:v1:' + day, 'json') as { neurons?: number } | null;
  return Math.max(0, Number(record?.neurons) || 0);
}
/** Reserve before every image inference call; any ledger failure blocks it. */
export async function reserveFreeImageNeurons(neurons: number, now = Date.now()): Promise<void> {
  if (!safeImageSpendingEnabled()) return;
  if (!Number.isFinite(neurons) || neurons <= 0 || neurons > BOOP_DAILY_IMAGE_NEURON_LIMIT)
    throw new ImageBudgetExceeded();
  try {
    const day = utcBudgetDay(now);
    const floor = await legacyBudgetFloor(day);
    const response = await imageLedger().fetch(new Request('https://budget.internal/reserve', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ day, neurons, floor }),
    }));
    const result = response.ok ? await response.json() as Usage : null;
    if (result?.allowed !== true) throw new ImageBudgetExceeded();
  } catch (error) {
    if (!(error instanceof ImageBudgetExceeded))
      console.warn('Boop atomic image ledger unavailable; inference blocked.');
    throw new ImageBudgetExceeded();
  }
}
/** The recovery UI reads the same durable counter, never the old KV alone. */
export async function getImageNeuronsUsed(now = Date.now()): Promise<number> {
  if (!safeImageSpendingEnabled()) return 0;
  try {
    const day = utcBudgetDay(now);
    const floor = await legacyBudgetFloor(day);
    const url = new URL('https://budget.internal/status');
    url.searchParams.set('day', day);
    const response = await imageLedger().fetch(new Request(url));
    if (!response.ok) throw new Error('Budget ledger unavailable');
    const record = await response.json() as Usage;
    if (typeof record.used !== 'number' || !Number.isFinite(record.used))
      throw new Error('Invalid budget response');
    return Math.max(floor, record.used);
  } catch {
    // An unavailable counter must never be displayed as unused allowance.
    throw new ImageBudgetExceeded();
  }
}
/** Historical test API: no in-memory counter remains to reset. */
export function resetImageBudgetForTests(): void { /* Durable Object state is external. */ }
