import type { InfiniteElement } from './infiniteCraftData';
import type { Material } from '../types';
import { discoveryIdentity } from './unifiedCollection';

/**
 * Shared discoveries, re-applied from PR #107 on the restored base.
 *
 * Adaptation vs the original #107: the restored tree already merges Foundry
 * into Craft on save load/write (see saveData.ts / unifiedCollection.ts), so
 * this is a derived, view-layer merge only — it never writes or migrates
 * either saved collection. It covers the case where Foundry materials change
 * while Craft is already mounted, before the next craft save write. Craft
 * entries always win on a name collision, and neither input array is mutated.
 * Deduplication uses discoveryIdentity (NFKC, whitespace-collapsed, lowercase),
 * which is slightly stricter than #107's trim-only normalisation.
 */
export function mergeSharedDiscoveries(craft: InfiniteElement[], materials: Material[]): InfiniteElement[] {
  const names = new Set(craft.map(item => discoveryIdentity(item.name)));
  const shared = [...craft];
  for (const material of materials) {
    const key = discoveryIdentity(material.displayName);
    if (!key || names.has(key)) continue;
    names.add(key);
    shared.push({ id: `foundry_${material.id}`, name: material.displayName, emoji: '✨',
      customSpriteUrl: material.customSpriteUrl, discoveredAt: material.discoveredAt,
      explanation: material.discoveryExplanation || undefined });
  }
  return shared;
}
