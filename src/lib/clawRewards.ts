import { categoryForDiscovery } from './collectionCategories';
import { addCraftCopy } from './elementCopies';
import { initialCraftStats, normalizeElementStats } from './elementStats';
import type { InfiniteElement } from './infiniteCraftData';
import { discoveryIdentity } from './unifiedCollection';

const finishes = ['Amber', 'Brass', 'Ceramic', 'Crystal', 'Jade', 'Opal', 'Pearl', 'Silver'];
const objects = [
  { name: 'Bell', emoji: '🔔' },
  { name: 'Compass', emoji: '🧭' },
  { name: 'Crown', emoji: '👑' },
  { name: 'Dice', emoji: '🎲' },
  { name: 'Key', emoji: '🗝️' },
  { name: 'Lantern', emoji: '🏮' },
  { name: 'Marble', emoji: '🔮' },
  { name: 'Rocket', emoji: '🚀' },
];

const rewards = finishes.flatMap(finish => objects.map(object => ({
  name: `${finish} ${object.name}`,
  emoji: object.emoji,
})));

export function applyClawReward(existing: readonly InfiniteElement[], roll: number, timestamp = Date.now()) {
  const owned = new Map(existing.map((item, index) => [discoveryIdentity(item.name), index] as const));
  const undiscovered = rewards.filter(item => !owned.has(discoveryIdentity(item.name)));
  const pool = undiscovered.length ? undiscovered : rewards;
  const prize = pool[Math.floor(roll * pool.length)];
  const index = owned.get(discoveryIdentity(prize.name));

  if (index !== undefined) {
    const previous = normalizeElementStats(existing[index]);
    const item: InfiniteElement = {
      ...previous,
      isNew: false,
      copyCounts: addCraftCopy(previous, 'normal'),
      craftCount: (previous.craftCount ?? 0) + 1,
      lastCraftedAt: timestamp,
    };
    const elements = [...existing];
    elements[index] = item;
    return { elements, item };
  }

  const item: InfiniteElement = {
    ...prize,
    id: `claw_${crypto.randomUUID()}`,
    category: categoryForDiscovery(prize),
    discoveredAt: timestamp,
    isNew: true,
    explanation: 'Found inside a mystery capsule from Boop Claw.',
    copyCounts: addCraftCopy(undefined, 'normal'),
    ...initialCraftStats(undefined, false, timestamp),
  };
  return { elements: [item, ...existing], item };
}
