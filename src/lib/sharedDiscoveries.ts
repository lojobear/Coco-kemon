import type { InfiniteElement } from './infiniteCraftData';
import type { Material } from '../types';

/** A read-only shared catalogue; the original mode-specific saves remain intact. */
export function mergeSharedDiscoveries(craft: InfiniteElement[], materials: Material[]): InfiniteElement[] {
  const names = new Set(craft.map(item => item.name.trim().normalize('NFKC').toLowerCase()));
  const shared = [...craft];
  for (const material of materials) {
    const key = material.displayName.trim().normalize('NFKC').toLowerCase();
    if (!key || names.has(key)) continue;
    names.add(key);
    shared.push({ id: `foundry_${material.id}`, name: material.displayName, emoji: '✨',
      customSpriteUrl: material.customSpriteUrl, discoveredAt: material.discoveredAt,
      explanation: material.discoveryExplanation || undefined });
  }
  return shared;
}
