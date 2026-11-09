import type { InfiniteElement } from './infiniteCraftData';

const craftStarters = new Set(['water', 'fire', 'wind', 'earth']);
const foundryStarters = new Set(['water', 'stone', 'soil', 'plant', 'metal', 'spark']);
export const LEGACY_STARTER_DATE = 1700000000000;

/** Recognize only the original supplied inventory; never infer from a name alone for earned items. */
export function isSuppliedStarter(item: InfiniteElement): boolean {
  if (item.isStarter) return true;
  const name = item.name.trim().toLowerCase();
  return (!item.discoveredAt && !item.recipe && craftStarters.has(name)) ||
    (item.id.startsWith('foundry_') && item.discoveredAt === LEGACY_STARTER_DATE && foundryStarters.has(name));
}
