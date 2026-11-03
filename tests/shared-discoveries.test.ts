import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSharedDiscoveries } from '../src/lib/sharedDiscoveries.ts';
import type { Material } from '../src/types';

const material = (id: string, displayName: string, customSpriteUrl?: string) => ({
  id, displayName, customSpriteUrl, discoveredAt: 42, discoveryExplanation: 'A discovery',
} as Material);

test('shares unique Foundry discoveries without changing either saved collection', () => {
  const craft = [{ id: 'water', name: 'Water', emoji: '💧' }];
  const foundry = [material('w', ' water '), material('dog', 'Dog', 'art')];
  const result = mergeSharedDiscoveries(craft, foundry);
  assert.deepEqual(result.map(item => item.name), ['Water', 'Dog']);
  assert.equal(result[1].customSpriteUrl, 'art');
  assert.equal(craft.length, 1);
  assert.equal(foundry.length, 2);
});

test('deduplicates normalized Foundry names and retains Craft data', () => {
  const craft = [{ id: 'cafe', name: 'Café', emoji: '☕' }];
  const result = mergeSharedDiscoveries(craft, [material('x', 'Cafe\u0301'), material('y', 'Spark'), material('z', 'spark')]);
  assert.equal(result.length, 2);
  assert.equal(result[0], craft[0]);
});
