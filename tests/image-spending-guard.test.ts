import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPersistentCacheBinding } from '../server/cacheBinding';
import { BOOP_DAILY_IMAGE_NEURON_LIMIT, FLUX2_KLEIN_512_NEURONS, FLUX1_SCHNELL_8STEP_NEURONS, ImageBudgetExceeded, reserveFreeImageNeurons, resetImageBudgetForTests, utcBudgetDay } from '../server/imageSpendingGuard';
import { publicFailure } from '../server/gemini';

test('Daily per-app free neuron guard counts calls and fails closed at limit', async () => {
  const before=process.env.BOOP_SAFE_SPENDING;
  const kv=new Map<string,string>();
  process.env.BOOP_SAFE_SPENDING='1';
  resetImageBudgetForTests();
  setPersistentCacheBinding({
    get: async k=>JSON.parse(kv.get(k)||'null'),
    put: async (k,v)=>{kv.set(k,v);}
  });
  try {
    assert.equal(BOOP_DAILY_IMAGE_NEURON_LIMIT, 5000);
    assert.equal(FLUX2_KLEIN_512_NEURONS, 26.05);
    assert.equal(FLUX1_SCHNELL_8STEP_NEURONS, 81.6);
    assert.equal(utcBudgetDay(Date.UTC(2026,9,28,23,30)), '2026-10-28');
    await reserveFreeImageNeurons(4900);
    await reserveFreeImageNeurons(80);
    await assert.rejects(reserveFreeImageNeurons(FLUX1_SCHNELL_8STEP_NEURONS), ImageBudgetExceeded);
    assert.equal(publicFailure(new ImageBudgetExceeded()).status, 429);
    assert.equal([...kv.values()].map(v=>JSON.parse(v).neurons)[0], 4980);
    setPersistentCacheBinding(undefined);
    await assert.rejects(reserveFreeImageNeurons(FLUX2_KLEIN_512_NEURONS), ImageBudgetExceeded);
  } finally {
    resetImageBudgetForTests();
    setPersistentCacheBinding(undefined);
    if(before===undefined)delete process.env.BOOP_SAFE_SPENDING;
    else process.env.BOOP_SAFE_SPENDING=before;
  }
});

test('production config defaults to free-image-only and paid providers cannot bypass guard', () => {
  const cfg=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  assert.match(cfg, /"BOOP_SAFE_SPENDING": "1"/);
  const provider=readFileSync(new URL('../server/gemini.ts',import.meta.url),'utf8');
  assert.match(provider, /await reserveFreeImageNeurons\(FLUX2_KLEIN_512_NEURONS\)/);
  assert.match(provider, /await reserveFreeImageNeurons\(FLUX1_SCHNELL_8STEP_NEURONS\)/);
  assert.match(provider, /if \(safeImageSpendingEnabled\(\)\) throw new ImageBudgetExceeded\(\)/);
  const queue=readFileSync(new URL('../src/lib/artworkQueue.ts',import.meta.url),'utf8');
  assert.match(queue, /Boop safe daily image allowance reached/);
});
