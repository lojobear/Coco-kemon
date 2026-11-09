import test from 'node:test';
import assert from 'node:assert/strict';
import { baseElementValue, elementValue, RARITY_VALUE_MULTIPLIERS, FORM_VALUE_MULTIPLIERS } from '../src/lib/elementValue';
import { RARITY_TIERS } from '../src/lib/rarity';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';
import { parseSave } from '../src/lib/saveData';
import { STARTER_MATERIALS, ALL_PROCESSES, INITIAL_HABITATS } from '../src/lib/starterData';
const foundry = { materials: STARTER_MATERIALS, oddkinCollection: [], processes: ALL_PROCESSES, habitats: INITIAL_HABITATS, experiments: [] };

const water: InfiniteElement = { id: 'water', name: 'Water', emoji: '💧' };

test('every existing and generated concept gets a deterministic positive whole-coin value', () => {
  const names = ['Water', 'Fire', 'Wind', 'Earth', 'Temporal Pancake', '月', '🪐', ''];
  for (let i = 0; i < 200; i++) names.push(`Future element ${i}`);
  for (const name of names) {
    const value = elementValue({ ...water, name });
    assert.ok(Number.isSafeInteger(value.coins) && value.coins >= 10 && value.coins <= 40);
    assert.equal(elementValue({ ...water, name }).coins, value.coins);
  }
  assert.equal(baseElementValue('  WATER  '), baseElementValue('Water'));
  assert.equal(baseElementValue('Sea  Lion'), baseElementValue('sea lion'));
  assert.equal(baseElementValue('Ｗａｔｅｒ'), baseElementValue('Water'));
});

test('rarer tiers and forms increase a concept’s value without stacking unlocked finishes', () => {
  let previous = 0;
  for (const tier of RARITY_TIERS) {
    const item = { ...water, rarityTier: tier.id, unlockedShiny: true, unlockedHolo: true,
      unlockedCelestial: true, unlockedGlitch: true };
    const base = elementValue(item, 'normal');
    assert.ok(base.coins > previous);
    previous = base.coins;
    for (const variant of ['normal','shiny','holo','celestial','glitch'] as const) {
      assert.equal(elementValue(item, variant).coins,
        baseElementValue('Water') * RARITY_VALUE_MULTIPLIERS[tier.id] * FORM_VALUE_MULTIPLIERS[variant]);
    }
    assert.equal(elementValue(item).variant, 'glitch');
    assert.equal(elementValue(item).coins, base.coins * 15);
    assert.ok(elementValue(item).coins <= 150000);
  }
});

test('locked forms and editable activity metadata cannot inflate the quote', () => {
  assert.equal(elementValue(water, 'glitch').variant, 'normal');
  assert.equal(elementValue(water, 'shiny').coins, elementValue(water).coins);
  const changed = { ...water, id: 'new-id', emoji: '🔥', craftCount: 999999, isNew: true,
    discoveredAt: Date.now(), customSpriteUrl: 'data:image/png;base64,AAAA', value: 99999999 };
  assert.equal(elementValue(changed).coins, elementValue(water).coins);
  assert.equal(elementValue({ ...water, shinyCraftCount: 1 }).variant, 'shiny');
});

test('old saves need no migration and backup imports preserve quoted values and selected forms', () => {
  const element: InfiniteElement = { ...water, rarityTier: 'rare', unlockedShiny: true, unlockedGlitch: true };
  const serialized = JSON.stringify({ version: 2, crafting: [element], foundry });
  const restored = parseSave(serialized).crafting![0];
  assert.deepEqual(elementValue(restored), elementValue(element));
  assert.equal(elementValue(restored, 'shiny').coins, elementValue(element, 'shiny').coins);
  assert.equal(Object.hasOwn(restored, 'value'), false);
  assert.ok(elementValue(parseSave(JSON.stringify({ version: 2, crafting: [water], foundry })).crafting![0]).coins > 0);
});
