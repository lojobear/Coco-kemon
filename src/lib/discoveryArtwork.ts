import type { Material } from '../types';
import { generateMaterialSprite } from './pixelRenderer';

/** Display-only artwork. Preserve uploaded or rerolled sprites and all save data. */
export function discoveryArtwork(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return ['coffee', 'mouse', 'spark', 'dog', 'mushroom', 'moon'].includes(key) ? `/art/${key}.png` : undefined;
}
export function materialArtwork(material: Material): string | undefined {
  const art = discoveryArtwork(material.displayName);
  if (!art) return material.customSpriteUrl;
  if (!material.customSpriteUrl || material.customSpriteUrl === generateMaterialSprite(material)) return art;
  return material.customSpriteUrl;
}
