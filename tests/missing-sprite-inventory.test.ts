import test from 'node:test';
import assert from 'node:assert/strict';
import { spriteInventoryItems, spriteInventoryState } from '../src/lib/missingSpriteInventory';
import type { ArtworkTask } from '../src/lib/artworkQueue';

const discoveries = [
  { id: 'river', name: 'River', discoveredAt: 10 },
  { id: 'opal', name: ' Opal Dragon ', discoveredAt: 20, unlockedShiny: true },
  { id: 'gem', name: 'Cobalt Gem', discoveredAt: 30, customSpriteUrl: 'data:image/png;base64,AAAA' },
] as any[];

test('inventory includes all Craft variants newest first and distinguishes custom artwork', () => {
  const items = spriteInventoryItems(discoveries as any);
  assert.equal(items.length, 4);
  assert.deepEqual(items.map(x => x.name), ['Cobalt Gem', 'Opal Dragon', 'Opal Dragon', 'River']);
  assert.deepEqual(items.map(x => x.shiny), [false, false, true, false]);
  assert.equal(items[0].customArt, true);
  assert.equal(items[2].key, 'shiny:opal dragon');
});

test('saved images, pending jobs, and missing art have distinct statuses', () => {
  const [custom, regular, shiny, missing] = spriteInventoryItems(discoveries as any);
  const pending: ArtworkTask[] = [
    { name: 'Opal Dragon', shiny: true, attempts: 2, nextAttemptAt: Date.now() + 30_000, lastError: 'Provider unavailable' },
    { name: 'Opal Dragon', shiny: false, attempts: 0, nextAttemptAt: 0 },
  ];
  assert.equal(spriteInventoryState(custom, undefined, pending).state, 'ready');
  assert.equal(spriteInventoryState(regular, true, pending).state, 'ready');
  assert.equal(spriteInventoryState(regular, false, pending).state, 'queued');
  assert.equal(spriteInventoryState(shiny, false, pending).state, 'retry');
  assert.equal(spriteInventoryState(missing, false, pending).state, 'missing');
  assert.equal(spriteInventoryState(missing, undefined, pending).state, 'checking');
});

test('list does not generate artwork while checking stored files', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/components/MissingSpritesList.tsx', import.meta.url), 'utf8');
  assert.match(src, /getElementEmoji\(entry.name, false, '', false, entry.shiny\)/);
  assert.match(src, /Queue 5 missing/);
  assert.match(src, /status.state === 'missing'/);
  const studio = readFileSync(new URL('../src/components/SpriteLabModal.tsx', import.meta.url), 'utf8');
  assert.match(studio, /<MissingSpritesList elements=\{craftElements\}/);
});
