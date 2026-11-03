import { getPersistentCacheBinding } from './cacheBinding.js';

/**
 * BOOP SPENDING GUARD
 * The Cloudflare $5 Workers Paid plan is a BASE charge, not a usage cap.
 * We only allow a conservative subset of the DAILY FREE Workers AI allocation
 * and disable paid image-provider fallbacks in gemini.ts.
 *
 * This cannot restrict other Workers, products, taxes or exchange rates.
 * KV writes are eventually consistent and other Workers may use neurons;
 * 5,000 leaves 5,000 neurons of headroom below the 10,000 daily account quota.
 * This is a cost-reduction guard, not an account-wide billing guarantee.
 */
export const BOOP_DAILY_IMAGE_NEURON_LIMIT = 5000;
export const FLUX2_KLEIN_512_NEURONS = 26.05;
export const FLUX1_SCHNELL_8STEP_NEURONS = 4.8 + 8 * 9.6;
const inMemory = new Map<string, number>();

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

/**
 * Reserve BEFORE each call, including retry calls that may be billed even if
 * the provider rejects them. If the budget store is unavailable, fail closed.
 */
export async function reserveFreeImageNeurons(neurons: number, now = Date.now()): Promise<void> {
  if (!safeImageSpendingEnabled()) return;
  if (!Number.isFinite(neurons) || neurons <= 0 || neurons > BOOP_DAILY_IMAGE_NEURON_LIMIT)
    throw new ImageBudgetExceeded();
  const kv = getPersistentCacheBinding();
  if (!kv?.get || !kv?.put) {
    console.warn('Boop image spending guard: budget store unavailable. Paid inference blocked.');
    throw new ImageBudgetExceeded();
  }
  const day = utcBudgetDay(now);
  const key = 'boop:image-free-neurons:v1:' + day;
  try {
    const record = await kv.get(key, 'json') as { neurons?: number } | null;
    const stored = typeof record?.neurons === 'number' && Number.isFinite(record.neurons)
      ? Math.max(0, record.neurons) : 0;
    const observed = Math.max(stored, inMemory.get(key) || 0);
    if (observed + neurons > BOOP_DAILY_IMAGE_NEURON_LIMIT) throw new ImageBudgetExceeded();
    const total = observed + neurons;
    // Fail closed on put errors; never call paid inference if the reservation
    // could not be written to the shared store.
    await kv.put(key, JSON.stringify({ neurons: total }), { expirationTtl: 2 * 86400 });
    inMemory.set(key, total);
  } catch (error) {
    if (error instanceof ImageBudgetExceeded) throw error;
    console.warn('Boop image spending guard: unable to reserve free neurons; inference blocked.');
    throw new ImageBudgetExceeded();
  }
}

export function resetImageBudgetForTests(): void {
  inMemory.clear();
}
