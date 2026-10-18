import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findCraftDropTarget, intersectionArea } from '../src/lib/craftCollision';
import { CANONICAL_INFINITE_CRAFT_RECIPES, makePairKey } from '../src/lib/infiniteCraftData';

test('craft overlap uses visible rectangle area, not proximity', () => {
  const moving = { left: 100, top: 100, width: 85, height: 40 };
  assert.equal(intersectionArea(moving, { left: 185, top: 100, width: 85, height: 40 }), 0);
  assert.equal(findCraftDropTarget(moving, [
    { item: 'close but not touching', rect: { left: 189, top: 100, width: 80, height: 40 } },
  ], { x: 175, y: 120 }), null);
  assert.equal(findCraftDropTarget(moving, [
    { item: 'target', rect: { left: 145, top: 102, width: 85, height: 40 } },
  ], { x: 161, y: 115 }), 'target');
  assert.equal(findCraftDropTarget(moving, [
    { item: 'tiny edge', rect: { left: 180, top: 100, width: 85, height: 40 } },
  ], { x: 100, y: 120 }), null);
});

test('overlapping multiple drops picks the most relevant target', () => {
  const moving = { left: 100, top: 100, width: 100, height: 50 };
  assert.equal(findCraftDropTarget(moving, [
    { item: 'far', rect: { left: 171, top: 100, width: 100, height: 50 } },
    { item: 'near', rect: { left: 122, top: 101, width: 100, height: 50 } },
  ], { x: 151, y: 126 }), 'near');
});

test('canonical recipes have no duplicate unordered ingredient pairs', () => {
  const source = readFileSync(new URL('../src/lib/infiniteCraftData.ts', import.meta.url), 'utf8');
  const regex = /\[makePairKey\('([^']+)', '([^']+)'\)\]:/g;
  const keys = new Set<string>();
  for (const match of source.matchAll(regex)) {
    const key = makePairKey(match[1], match[2]);
    assert.equal(keys.has(key), false, `Duplicate recipe: ${match[1]} + ${match[2]}`);
    keys.add(key);
  }
  assert.ok(keys.size > 90);
  assert.equal(CANONICAL_INFINITE_CRAFT_RECIPES[makePairKey('Water', 'Earth')].result, 'Mud');
  assert.equal(CANONICAL_INFINITE_CRAFT_RECIPES[makePairKey('Mud', 'Water')].result, 'Plant');
  assert.equal(CANONICAL_INFINITE_CRAFT_RECIPES[makePairKey('Fire', 'Water')].result, 'Steam');
});
