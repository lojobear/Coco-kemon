import test from 'node:test';
import assert from 'node:assert/strict';
import { spriteLabInventoryElements } from '../src/lib/spriteLabInventory';
import { spriteInventoryItems, spriteInventoryState } from '../src/lib/missingSpriteInventory';

const placeholder = 'data:image/png;base64,AAAA';
const upload = 'data:image/png;base64,BBBB';
const materials = [
  { id: 'm1', displayName: '  Crystal  ', category: 'mineral', customSpriteUrl: placeholder, discoveredAt: 20 },
  { id: 'm2', displayName: ' Lantern ', category: 'technology', customSpriteUrl: upload, discoveredAt: 30 },
] as any[];
const render = (m: any) => m.id === 'm1' ? placeholder : 'data:image/png;base64,CCCC';

test('includes live Foundry items and does not mark procedural art ready', () => {
  const craft = [{ id: 'water', name: 'Water', emoji: '💧' }] as any[];
  const elements = spriteLabInventoryElements(craft, materials, render);
  assert.deepEqual(elements.map(x => x.name), ['Water', 'Crystal', 'Lantern']);
  const crystal = spriteInventoryItems(elements).find(x => x.name === 'Crystal')!;
  assert.equal(crystal.customArt, false);
  assert.equal(spriteInventoryState(crystal, false, []).state, 'missing');
  assert.equal(spriteInventoryItems(elements).find(x => x.name === 'Lantern')!.customArt, true);
  assert.equal(craft.length, 1);
  assert.equal(materials[0].customSpriteUrl, placeholder);
});

test('deduplicates an existing shared discovery and preserves user artwork', () => {
  const craft = [{ id: 'old', name: 'crystal', emoji: '💎', customSpriteUrl: placeholder },
    { id: 'custom', name: 'Lantern', emoji: '🏮', customSpriteUrl: upload }] as any[];
  const elements = spriteLabInventoryElements(craft, materials, render);
  assert.equal(elements.length, 2);
  assert.equal(elements[0].customSpriteUrl, undefined);
  assert.equal(elements[1].customSpriteUrl, upload);
  assert.equal(craft[0].customSpriteUrl, placeholder);
});

test('never strips unmatched artwork or storage references', () => {
  const craft = [{ id: 'custom', name: 'Crystal', emoji: '💎', customSpriteUrl: upload }] as any[];
  assert.equal(spriteLabInventoryElements(craft, materials, render)[0].customSpriteUrl, upload);
  assert.equal(spriteLabInventoryElements([{ ...craft[0], customSpriteUrl: 'sprite-ref:example' }], materials, render)[0].customSpriteUrl, 'sprite-ref:example');
});
