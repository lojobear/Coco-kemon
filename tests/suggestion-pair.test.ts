import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseUndiscoveredPair } from '../src/lib/randomSpawn';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';

const items = (names: string[]) => names.map(name => ({ id: name.toLowerCase(), name, emoji: '✨' } as InfiniteElement));
const recipes = {
  'earth:::water': { result: 'Mud' },
  'fire:::water': { result: 'Steam' },
  'water:::water': { result: 'Lake' },
};

test('suggestions use owned ingredients and prioritize undiscovered results', () => {
  const collection = items(['Water', 'Earth', 'Mud']);
  assert.equal(chooseUndiscoveredPair(collection, recipes, () => 0)?.map(x => x.name).join('+'), 'Water+Water');
  const pair = chooseUndiscoveredPair(items(['Water', 'Fire']), recipes, () => 0);
  assert.deepEqual(pair?.map(x => x.name), ['Fire', 'Water']);
});

test('suggestions handle normalized names and return null when nothing new is known', () => {
  assert.equal(chooseUndiscoveredPair(items(['  WATER ', 'earth', 'Mud', 'Lake']), recipes, () => 0), null);
  assert.equal(chooseUndiscoveredPair([], recipes), null);
});
