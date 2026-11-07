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

test('a Foundry item never overwrites a Craft entry of the same name', () => {
  const craft = [{ id: 'dog', name: 'Dog', emoji: '🐶', customSpriteUrl: 'craft-art' }];
  const result = mergeSharedDiscoveries(craft, [material('d', 'Dog', 'foundry-art')]);
  assert.equal(result.length, 1);
  assert.equal(result[0].customSpriteUrl, 'craft-art');
});

test('live Oddkin are visible in Craft without mutating either source', () => {
  const craft = [{ id: 'fox', name: 'Fox', emoji: '🦊', craftCount: 12 }];
  const oddkin = [{ speciesId: 'odd_1', speciesName: 'Starlight Moth',
    customSpriteUrl: 'data:image/png;base64,' + 'a'.repeat(120) }] as any[];
  const merged = mergeSharedDiscoveries(craft, [], oddkin);
  assert.deepEqual(merged.map(item => item.name), ['Fox', 'Starlight Moth']);
  assert.equal(merged[0], craft[0]);
  assert.equal(merged[1].customSpriteUrl, oddkin[0].customSpriteUrl);
  assert.equal(mergeSharedDiscoveries(merged, [], oddkin), merged);
});
