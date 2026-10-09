import type { ExperimentLog, Material, Oddkin, Rarity } from '../types';

export type MaterialVariant = 'holographic' | 'ancient' | 'glitched' | 'corrupted';

export const COLLECTION_SETS = [
  { id: 'living-lab', name: 'Living Lab', hint: 'Organic, biological, and living discoveries', test: (m: Material) => m.properties.living || m.properties.organic, target: 8 },
  { id: 'hot-stuff', name: 'Hot Stuff', hint: 'Heat, fire, plasma, and incandescent discoveries', test: (m: Material) => m.temperatureClass === 'hot' || m.temperatureClass === 'incandescent' || m.semanticTags.some(t => /fire|heat|magma|lava|plasma/i.test(t)), target: 6 },
  { id: 'machine-age', name: 'Machine Age', hint: 'Metallic, synthetic, technology, and tool discoveries', test: (m: Material) => m.properties.metallic || m.properties.synthetic || /technology|tool|metal|machine|device/i.test(m.category + ' ' + m.subcategory), target: 8 },
  { id: 'strange-world', name: 'Strange World', hint: 'Rare, exotic, mythic, or anomalous discoveries', test: (m: Material) => ['RARE','EXOTIC','MYTHIC','ANOMALOUS'].includes(m.rarity), target: 6 },
] as const;

const rarityXp: Record<Rarity, number> = {
  COMMON: 12,
  UNCOMMON: 20,
  RARE: 38,
  EXOTIC: 65,
  MYTHIC: 110,
  ANOMALOUS: 160,
};

export function progressionXp(materials: Material[], oddkin: Oddkin[], experiments: ExperimentLog[]): number {
  const materialXp = materials.reduce((sum, m) => sum + rarityXp[m.rarity] + (m.variant ? 35 : 0), 0);
  const oddkinXp = oddkin.reduce((sum, o) => sum + 90 + rarityXp[o.rarity] + (o.isChromaActive ? 75 : 0), 0);
  const experimentXp = experiments.reduce((sum, e) => sum + (e.success ? 2 : 0) + (e.xpBonus || 0), 0);
  return materialXp + oddkinXp + experimentXp;
}

export function levelFromXp(xp: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 90)) + 1);
  const currentFloor = 90 * (level - 1) ** 2;
  const nextFloor = 90 * level ** 2;
  return {
    level,
    current: Math.max(0, xp - currentFloor),
    required: Math.max(1, nextFloor - currentFloor),
    total: xp,
  };
}

export function discoveryStreak(experiments: ExperimentLog[]): number {
  let streak = 0;
  for (const e of experiments) {
    if (!e.success || !e.wasNew) break;
    streak += 1;
  }
  return streak;
}

export function setProgress(materials: Material[]) {
  return COLLECTION_SETS.map(set => {
    const count = materials.filter(set.test).length;
    return { ...set, count, complete: count >= set.target };
  });
}

function localDay(timestamp: number) {
  const d = new Date(timestamp);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
}

export function dailyGoals(materials: Material[], experiments: ExperimentLog[]) {
  const today = localDay(Date.now());
  const todayMaterials = materials.filter(m => localDay(m.discoveredAt) === today);
  const todayExperiments = experiments.filter(e => localDay(e.timestamp) === today);
  const processes = new Set(todayExperiments.filter(e => e.success).map(e => e.processName));
  const rarePlus = todayMaterials.filter(m => ['RARE','EXOTIC','MYTHIC','ANOMALOUS'].includes(m.rarity)).length;
  return [
    { id: 'discover-3', label: 'Discover 3 new things', progress: Math.min(3, todayMaterials.length), target: 3 },
    { id: 'process-3', label: 'Use 3 different processes', progress: Math.min(3, processes.size), target: 3 },
    { id: 'rare-1', label: 'Find a Rare+ discovery', progress: Math.min(1, rarePlus), target: 1 },
  ];
}

export function nearMissHint(materials: Material[]): string | null {
  const incomplete = setProgress(materials)
    .filter(s => !s.complete && s.count > 0)
    .sort((a,b) => (a.target - a.count) - (b.target - b.count))[0];
  if (!incomplete) return 'Start branching into different categories to uncover hidden collection sets.';
  const left = incomplete.target - incomplete.count;
  return left === 1
    ? `Almost there: one more discovery can finish the “${incomplete.name}” set.`
    : `${left} more matching discoveries will finish the “${incomplete.name}” set.`;
}

export function rollMaterialVariant(rarity: Rarity): MaterialVariant | undefined {
  const baseChance: Record<Rarity, number> = {
    COMMON: 0.025,
    UNCOMMON: 0.04,
    RARE: 0.065,
    EXOTIC: 0.10,
    MYTHIC: 0.14,
    ANOMALOUS: 0.18,
  };
  if (Math.random() >= baseChance[rarity]) return undefined;
  const variants: MaterialVariant[] = ['holographic', 'ancient', 'glitched', 'corrupted'];
  return variants[Math.floor(Math.random() * variants.length)];
}

export function nextStreakMilestone(streak: number) {
  return [3,5,10,25,50].find(n => n > streak) ?? Math.ceil((streak + 1) / 25) * 25;
}


export function streakReward(streak: number): number {
  if (streak >= 50 && streak % 25 === 0) return 500;
  if (streak === 25) return 300;
  if (streak === 10) return 150;
  if (streak === 5) return 75;
  if (streak === 3) return 35;
  return 0;
}
