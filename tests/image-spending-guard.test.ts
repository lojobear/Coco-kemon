import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPersistentCacheBinding } from '../server/cacheBinding';
import { setImageBudgetBinding } from '../server/imageBudgetBinding';
import { BoopImageBudgetLedger } from '../server/imageBudgetLedger';
import { BOOP_DAILY_IMAGE_NEURON_LIMIT, FLUX2_KLEIN_512_NEURONS, FLUX1_SCHNELL_8STEP_NEURONS, ImageBudgetExceeded, reserveFreeImageNeurons, getImageNeuronsUsed, utcBudgetDay } from '../server/imageSpendingGuard';
import { publicFailure } from '../server/gemini';

function fakeLedger() {
  const data = new Map<string, any>();
  let tail: Promise<void> = Promise.resolve();
  const storage = {
    get: async (key: string) => data.get(key),
    transaction: async <T>(fn: (txn: any) => Promise<T>): Promise<T> => {
      const prev = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await prev;
      try {
        return await fn({
          get: storage.get,
          put: async (key: string, value: unknown) => { data.set(key, value); },
        });
      } finally { release(); }
    },
  };
  const ledger = new BoopImageBudgetLedger({ storage });
  return { data, binding: { idFromName: () => 'global', get: () => ({ fetch: (request: Request) => ledger.fetch(request) }) } };
}
test('Daily image budget is transactionally reserved even for concurrent requests', async () => {
  const before = process.env.BOOP_SAFE_SPENDING;
  const kv = new Map<string, string>();
  process.env.BOOP_SAFE_SPENDING = '1';
  const { data, binding } = fakeLedger();
  setImageBudgetBinding(binding);
  setPersistentCacheBinding({
    get: async key => JSON.parse(kv.get(key) || 'null'),
    put: async (key, value) => { kv.set(key, value); },
  });
  try {
    assert.equal(BOOP_DAILY_IMAGE_NEURON_LIMIT, 10_000);
    assert.equal(FLUX2_KLEIN_512_NEURONS, 26.05);
    assert.equal(FLUX1_SCHNELL_8STEP_NEURONS, 81.6);
    assert.equal(utcBudgetDay(Date.UTC(2026, 9, 28, 23, 30)), '2026-10-28');
    await reserveFreeImageNeurons(9900);
    const outcomes = await Promise.allSettled([
      reserveFreeImageNeurons(80), reserveFreeImageNeurons(80),
    ]);
    assert.equal(outcomes.filter(entry => entry.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(entry => entry.status === 'rejected').length, 1);
    assert.equal(await getImageNeuronsUsed(), 9980);
    assert.equal(data.get('neurons:' + utcBudgetDay()).neurons, 9980);
    assert.equal(publicFailure(new ImageBudgetExceeded()).status, 429);
    setImageBudgetBinding(undefined);
    await assert.rejects(reserveFreeImageNeurons(1), ImageBudgetExceeded);
  } finally {
    setImageBudgetBinding(undefined);
    setPersistentCacheBinding(undefined);
    if (before === undefined) delete process.env.BOOP_SAFE_SPENDING;
    else process.env.BOOP_SAFE_SPENDING = before;
  }
});
test('Old KV usage remains part of the new budget during migration', async () => {
  const before = process.env.BOOP_SAFE_SPENDING;
  process.env.BOOP_SAFE_SPENDING = '1';
  const { binding } = fakeLedger();
  setImageBudgetBinding(binding);
  setPersistentCacheBinding({ get: async () => ({ neurons: 9999 }), put: async () => undefined });
  try {
    assert.equal(await getImageNeuronsUsed(), 9999);
    await assert.rejects(reserveFreeImageNeurons(26.05), ImageBudgetExceeded);
    assert.equal(await getImageNeuronsUsed(), 9999);
  } finally {
    setImageBudgetBinding(undefined);
    setPersistentCacheBinding(undefined);
    if (before === undefined) delete process.env.BOOP_SAFE_SPENDING;
    else process.env.BOOP_SAFE_SPENDING = before;
  }
});
test('production uses the atomic ledger and disables paid image provider fallbacks', () => {
  const cfg = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"BOOP_SAFE_SPENDING": "1"/);
  assert.match(cfg, /"new_sqlite_classes": \["BoopImageBudgetLedger"\]/);
  const worker = readFileSync(new URL('../worker.ts', import.meta.url), 'utf8');
  assert.match(worker, /setImageBudgetBinding\(env.BOOP_IMAGE_BUDGET\)/);
  const provider = readFileSync(new URL('../server/gemini.ts', import.meta.url), 'utf8');
  assert.match(provider, /await reserveFreeImageNeurons\(FLUX2_KLEIN_512_NEURONS\)/);
  assert.match(provider, /await reserveFreeImageNeurons\(FLUX1_SCHNELL_8STEP_NEURONS\)/);
  assert.match(provider, /if \(safeImageSpendingEnabled\(\)\) throw new ImageBudgetExceeded\(\)/);
  const guard = readFileSync(new URL('../server/imageSpendingGuard.ts', import.meta.url), 'utf8');
  assert.match(guard, /NOT a hard billing cap/);
  assert.match(guard, /leaving NO headroom/);
  const queue = readFileSync(new URL('../src/lib/artworkQueue.ts', import.meta.url), 'utf8');
  assert.match(queue, /not an account-wide billing cap/);
});
