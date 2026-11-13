/** Shared allowlist: styles affect explicit edits only, never automatic discoveries. */
export const SPRITE_ART_STYLES = {
  classic: { label: 'Classic Boop', description: 'Compact isometric furni pixel art', prompt: '' },
  retro: { label: 'Retro 16-bit', description: 'Chunky pixels, classic RPG palette', prompt: 'Classic 16-bit RPG inventory pixel art; chunky square pixel clusters, limited 16–24 color palette, strong silhouette, stepped shadows, crisp hard edges. No gradients.' },
  hd: { label: 'HD Pixel Art', description: 'Fine pixels, richer textures', prompt: 'High-definition pixel art inventory icon; fine crisp pixel clusters, rich material texture, precise highlights, detailed readable silhouette, no smooth gradients or anti-aliasing.' },
  glossy: { label: 'Glossy 3D', description: 'Polished collectible toy render', prompt: 'Polished stylized 3D collectible inventory icon, smooth rounded surfaces, glossy material highlights, subtle ambient occlusion within the object, clean studio lighting, no pixelation or outline.' },
  chibi: { label: 'Chibi', description: 'Cute rounded proportions', prompt: 'Chibi collectible icon, cute compact proportions, soft rounded shapes, expressive anatomy for living subjects only, clean outlines and smooth pastel cel shading; no pixelation.' },
  illustrated: { label: 'Illustrated', description: 'Hand-drawn lines and cel shading', prompt: 'Hand-drawn fantasy inventory illustration, confident ink contours, crisp cel shading, rich colors and recognizable material detail, smooth edges, no pixelation.' },
} as const;
export type SpriteArtStyle = keyof typeof SPRITE_ART_STYLES;
export function isSpriteArtStyle(value: unknown): value is SpriteArtStyle {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPRITE_ART_STYLES, value);
}
export function styleDirection(style: SpriteArtStyle): string {
  return SPRITE_ART_STYLES[style].prompt;
}
export function readPromptArtStyle(prompt: string): SpriteArtStyle {
  const value = prompt.match(/^ART STYLE ID: ([a-z]+)$/m)?.[1];
  return isSpriteArtStyle(value) ? value : 'classic';
}
