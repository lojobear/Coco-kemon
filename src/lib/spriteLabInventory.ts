import type { InfiniteElement } from './infiniteCraftData';
import type { Material } from '../types';
import { discoveryIdentity, mergeFoundryIntoCraft } from './unifiedCollection';

/**
 * A read-only inventory projection. Foundry's deterministic placeholders may
 * already have been copied into Craft's customSpriteUrl by older saves. Compare
 * them to the actual Foundry material's renderer output before treating them
 * as missing. Never modify persisted saves or guess about unmatched artwork.
 */
export function spriteLabInventoryElements(
  craft: readonly InfiniteElement[],
  materials: readonly Material[],
  renderPlaceholder: (material: Material) => string,
): InfiniteElement[] {
  const byName = new Map<string, Material>();
  for (const material of materials) {
    const key = discoveryIdentity(material.displayName);
    if (key && !byName.has(key)) byName.set(key, material);
  }
  const combined = mergeFoundryIntoCraft(craft, { materials });
  return combined.map(item => {
    const material = byName.get(discoveryIdentity(item.name));
    if (!material || !item.customSpriteUrl || item.customSpriteUrl !== material.customSpriteUrl) return item;
    // Only inline images can be these local canvas placeholders. References
    // and different art may be uploads or rerolls and must stay untouched.
    if (!item.customSpriteUrl.startsWith('data:image/png;base64,')) return item;
    let placeholder = '';
    try { placeholder = renderPlaceholder(material); } catch { return item; }
    if (!placeholder || placeholder !== item.customSpriteUrl) return item;
    return { ...item, customSpriteUrl: undefined };
  });
}
