import type { InfiniteElement } from './infiniteCraftData';
import type { Material, Oddkin } from '../types';
import { discoveryIdentity, mergeFoundryIntoCraft } from './unifiedCollection';
import { categoryForDiscovery } from './collectionCategories';

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
export function mergeSharedDiscoveries(craft: InfiniteElement[], materials: readonly Material[], oddkinCollection: readonly Oddkin[] = []): InfiniteElement[] {
  const names = new Set(craft.map(item => discoveryIdentity(item.name)));
  const byName=new Map(materials.map(material=>[discoveryIdentity(material.displayName),material]));
  // Reuse Foundry metadata only when the Craft record has none; both views
  // consume this exact read-only projection rather than inventing shelves.
  let enriched=craft;
  for(let i=0;i<craft.length;i++){
    const item=craft[i],material=byName.get(discoveryIdentity(item.name));
    if(!material||item.category)continue;
    if(enriched===craft)enriched=[...craft];
    enriched[i]={...item,category:material.category};
  }
  // Preserve identity on no-op merges so mounted Craft galleries do not rerender.
  let shared = enriched;
  for (const material of materials) {
    const key = discoveryIdentity(material.displayName);
    if (!key || names.has(key)) continue;
    names.add(key);
    if (shared === enriched) shared = [...enriched];
    shared.push({ id: `foundry_${material.id}`, name: material.displayName, emoji: '✨',
      category: material.category || categoryForDiscovery({ name: material.displayName }),
      customSpriteUrl: material.customSpriteUrl, discoveredAt: material.discoveredAt,
      explanation: material.discoveryExplanation || undefined });
  }
  // Include live Foundry creatures, not only materials. Keep the projection
  // read-only and reuse the save merge's Oddkin identity/metadata rules.
  return mergeFoundryIntoCraft(shared, { oddkinCollection });
}
