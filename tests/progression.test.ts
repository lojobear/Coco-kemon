import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyGoals, discoveryStreak, levelFromXp, nearMissHint, progressionXp, setProgress, streakReward } from '../src/lib/progression';
import type { ExperimentLog, Material } from '../src/types';

const baseMaterial = (name: string, patch: Partial<Material> = {}): Material => ({
  id: name.toLowerCase(),
  canonicalName: name.toUpperCase(),
  displayName: name,
  description: name,
  category: 'Organic',
  subcategory: 'Test',
  stateOfMatter: 'solid',
  properties: {
    organic: true, living: false, edible: false, metallic: false, mineral: false,
    liquid: false, gaseous: false, crystalline: false, synthetic: false, conductive: false,
    magnetic: false, flammable: false, toxic: false, fragile: false, elastic: false, porous: false,
  },
  temperatureClass: 'ambient',
  semanticTags: [],
  lineage: { parentIds: [], depth: 1, generation: 1 },
  rarity: 'COMMON',
  discoveredAt: Date.now(),
  possibleProcessAffinities: ['MIX'],
  lifePotential: 20,
  spriteDescriptor: { palette: ['#111111'], baseShape: 'curio', primaryColor: '#111111', secondaryColor: '#222222', accentColor: '#333333' },
  discoveryExplanation: name,
  ...patch,
});

const exp = (wasNew: boolean, processName = 'Mix', xpBonus = 0): ExperimentLog => ({
  id: Math.random().toString(),
  timestamp: Date.now(),
  inputNames: ['A','B'],
  processName,
  success: true,
  observation: 'ok',
  wasNew,
  xpBonus,
});

test('discovery streak stops at the first rediscovery or failure boundary', () => {
  assert.equal(discoveryStreak([exp(true), exp(true), exp(false), exp(true)]), 2);
});

test('streak milestones award escalating XP', () => {
  assert.equal(streakReward(2), 0);
  assert.equal(streakReward(3), 35);
  assert.equal(streakReward(5), 75);
  assert.equal(streakReward(10), 150);
  assert.equal(streakReward(25), 300);
  assert.equal(streakReward(50), 500);
});

test('daily goals and collection sets derive from saved gameplay data', () => {
  const materials = [
    baseMaterial('Fern'),
    baseMaterial('Flame', { temperatureClass: 'hot', semanticTags: ['fire'] }),
    baseMaterial('Machine', { category: 'Technology', properties: { ...baseMaterial('x').properties, synthetic: true } }),
  ];
  const goals = dailyGoals(materials, [exp(true, 'Mix'), exp(true, 'Heat'), exp(true, 'Freeze')]);
  assert.equal(goals.find(g => g.id === 'discover-3')?.progress, 3);
  assert.equal(goals.find(g => g.id === 'process-3')?.progress, 3);
  assert.ok(setProgress(materials).some(s => s.count > 0));
  assert.ok(nearMissHint(materials));
});

test('XP includes rarity, variants, creatures and streak rewards', () => {
  const materials = [baseMaterial('Rare Thing', { rarity: 'RARE', variant: 'holographic' })];
  const xp = progressionXp(materials, [], [exp(true, 'Mix', 35)]);
  assert.ok(xp >= 100);
  assert.ok(levelFromXp(xp).level >= 2);
});
