import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSpriteReadiness } from '../src/lib/spriteScan';

test('sprite scans publish fewer UI updates with maximum four storage reads in flight', async () => {
  const items = Array.from({ length: 33 }, (_, i) => ({ name: 'Art ' + i, shiny: false, key: String(i) }));
  let running = 0, peak = 0, calls = 0;
  const updates: number[] = [];
  const checked = await scanSpriteReadiness(items, async () => {
    calls++; running++; peak = Math.max(peak, running);
    await new Promise(resolve => setTimeout(resolve, 1));
    running--; return true;
  }, (_batch, progress) => updates.push(progress));
  assert.equal(checked, 33);
  assert.equal(calls, 33);
  assert.ok(peak <= 4);
  assert.deepEqual(updates, [16, 32, 33]);
});
test('cancel prevents late batch updates', async () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ name: 'Art ' + i, shiny: false, key: String(i) }));
  let cancelled = false;
  const batches: number[] = [];
  const checked = await scanSpriteReadiness(items, async () => true,
    (_batch, progress) => { batches.push(progress); cancelled = true; }, () => cancelled);
  assert.equal(checked, 16);
  assert.deepEqual(batches, [16]);
});
