import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_ELEMENTS } from '../src/lib/infiniteCraftData';
import { STARTER_MATERIALS, INITIAL_HABITATS, ALL_PROCESSES } from '../src/lib/starterData';
import { mergeFoundryIntoCraft } from '../src/lib/unifiedCollection';
import { playerCraftStats } from '../src/lib/playerStats';
import { normalizeElementStats, recordElementCraft } from '../src/lib/elementStats';
import { applySharedPairDiscovery } from '../src/lib/sharedCraftingEngine';
import { parseSave } from '../src/lib/saveData';
import { craftProgressionXp } from '../src/lib/progression';

const now = Date.now();
const initial = () => mergeFoundryIntoCraft(STARTER_ELEMENTS, { materials: STARTER_MATERIALS });

test('supplied inventory earns no crafts, discoveries, activity, or Craft XP', () => {
  const items = initial();
  const stats = playerCraftStats(items, now);
  assert.equal(stats.totalElements, 9);
  assert.equal(stats.totalCrafts, 0);
  assert.equal(stats.uniqueDiscoveries, 0);
  assert.equal(stats.recent.length, 0);
  assert.equal(stats.mostCrafted.length, 0);
  assert.equal(stats.activity.reduce((n, day) => n + day.count, 0), 0);
  assert.equal(craftProgressionXp(items), 0);
});

test('one craft earns one discovery, one craft, and 12 XP, including after backup round trip', () => {
  const result = applySharedPairDiscovery(initial(), { result: 'Steam', emoji: '💨', isNew: false },
    'Water', 'Fire', { shiny: false, celestial: false, holo: false, glitch: false, tier: 'common' }, now);
  const backup = JSON.stringify({ version: 2, crafting: result.elements,
    foundry: { version: 1, materials: STARTER_MATERIALS, oddkinCollection: [], experiments: [], processes: ALL_PROCESSES, habitats: INITIAL_HABITATS } });
  const restored = parseSave(backup).crafting!;
  const stats = playerCraftStats(restored, now);
  assert.equal(stats.uniqueDiscoveries, 1);
  assert.equal(stats.totalCrafts, 1);
  assert.deepEqual(stats.recent.map(e => e.name), ['Steam']);
  assert.equal(craftProgressionXp(restored), 12);
});

test('legacy starter projection loses only phantom baseline; actual starter crafts remain', () => {
  const legacy = { id: 'foundry_stone', name: 'Stone', emoji: '🪨', discoveredAt: 1700000000000,
    craftCount: 1, firstCraftedAt: 1700000000000, lastCraftedAt: 1700000000000 };
  const normalized = normalizeElementStats(legacy);
  assert.equal(normalized.craftCount, 0);
  assert.equal(normalized.discoveredAt, 0);
  const crafted = recordElementCraft(normalized, { first: 'Lava', second: 'Water' }, false, now);
  const stats = playerCraftStats([crafted], now);
  assert.equal(stats.totalCrafts, 1);
  assert.equal(stats.uniqueDiscoveries, 0);
  assert.equal(crafted.firstCraftedAt, now);
  assert.equal(craftProgressionXp([crafted]), 12);
  assert.deepEqual(normalizeElementStats(crafted), crafted);
});

test('a player-discovered concept with a starter name keeps its earned history and artwork', () => {
  const earned = { id: 'stone', name: 'Stone', emoji: '🪨', discoveredAt: now, craftCount: 4,
    recipe: { first: 'Lava', second: 'Water' }, customSpriteUrl: 'data:image/png;base64,AAAA' };
  const merged = mergeFoundryIntoCraft([earned], { materials: STARTER_MATERIALS });
  assert.equal(merged.find(e => e.name === 'Stone'), earned);
  assert.equal(playerCraftStats(merged).totalCrafts, 4);
  assert.equal(playerCraftStats(merged).uniqueDiscoveries, 1);
});
