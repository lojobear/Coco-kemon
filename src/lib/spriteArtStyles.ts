/** Shared allowlist for explicit style edits; automatic generation stays classic. */
export const SPRITE_ART_STYLES = {
  classic: { label: 'Classic Boop', description: 'Compact isometric furni pixel art', prompt: '' },
  retro: { label: 'Retro 16-bit', description: 'Chunky pixels, classic RPG palette', prompt: 'Classic 16-bit RPG inventory pixel art; chunky square pixel clusters, limited 16–24 color palette, strong silhouette, stepped shadows, crisp hard edges. No gradients.' },
  hd: { label: 'HD Pixel Art', description: 'Fine pixels, richer textures', prompt: 'High-definition pixel art inventory icon; fine crisp pixel clusters, rich material texture, precise highlights, detailed readable silhouette, no smooth gradients or anti-aliasing.' },
  handheld: { label: 'Handheld Monster Pixel', description: 'Expressive collectible sprites with crisp outlines', prompt: 'Original handheld monster-collecting RPG inventory sprite, clean 1–2 pixel dark outlines, saturated local colours, compact expressive silhouette, crisp stepped highlights and shadows; no text or franchise branding.' },
  arcade: { label: 'Arcade 32-bit', description: 'Bold arcade shading and punchy colours', prompt: 'Detailed 32-bit arcade game inventory sprite, punchy contrast, clean stepped pixel clusters, saturated colours, dramatic readable highlights, no blurred gradients.' },
  micro: { label: 'Micro 8-bit', description: 'Tiny 32px icons with a restricted palette', prompt: '32x32 original 8-bit pixel inventory icon, 4–8 colours, bold clusters, minimal detail, no gradients or antialiasing.' },
  gameboy: { label: 'Monochrome Handheld', description: 'Four green-gray shades, retro handheld look', prompt: 'Original classic monochrome handheld game sprite, four distinct olive-green and charcoal shades, crisp 48x48 pixel grid, strong silhouette, no extra colours.' },
  advance: { label: 'GBA-style Pixel', description: 'Colourful 64px handheld RPG art', prompt: 'Original 64x64 handheld RPG inventory icon with a rich but limited palette, crisp local-colour outlines, readable clusters, vibrant highlights and stepped shadows.' },
  furni: { label: 'Isometric Furni', description: 'Detailed 2:1 furniture-style pixel art', prompt: 'Original isometric 2:1 pixel furniture inventory sprite, clean geometric construction, precise local-colour outlines, lively distinct material palettes, compact silhouette, no floor tile.' },
  dungeon: { label: 'Dungeon RPG', description: 'Dark fantasy loot with dramatic highlights', prompt: 'Original dark fantasy dungeon loot pixel icon, deep cool shadows, bright metallic or magical highlights, strong silhouette, controlled 24-colour palette, sharp square pixels.' },
  cozy: { label: 'Cozy Farming Pixel', description: 'Warm, cheerful farming-game inventory art', prompt: 'Original cozy farming RPG inventory pixel art, warm cheerful colours, soft rounded pixel clusters, crisp brown or local-colour outlines, simple tactile material details.' },
  tactics: { label: 'Tactical Isometric', description: 'Detailed strategy-game miniature pixels', prompt: 'Original tactical RPG isometric pixel miniature, precise 3/4 perspective, richly detailed material clusters, crisp diagonal pixel stair-steps, restrained shadows, no base or terrain.' },
  neon: { label: 'Neon Cyber Pixel', description: 'Electric cyan and violet arcade pixels', prompt: 'Original cyberpunk pixel inventory icon, dark ink outline, electric cyan and violet accents, sharply stepped neon highlights confined to silhouette, no glow outside subject.' },
  dither: { label: 'Dithered Retro', description: 'Limited palette with deliberate checker shading', prompt: 'Original retro computer pixel art, 12–16 colour palette, deliberate ordered dithering on material shadow planes, crisp pixel clusters and strong readable silhouette.' },
  storybook: { label: 'Storybook Pixel', description: 'Painterly pixel clusters and jewel-tone colours', prompt: 'Original storybook fantasy pixel inventory icon, jewel tones, intricate hand-placed pixel clusters, soft colour ramps expressed as discrete pixels, clear silhouette.' },
  metal: { label: 'Metallic Pixel', description: 'High-contrast metallic inventory icons', prompt: 'Original polished metallic RPG pixel icon, crisp stepped specular highlights, dark contrast, material-specific colour, carefully placed bright pixel accents, no smooth gradients.' },
  porcelain: { label: 'Porcelain Miniature', description: 'Glazed ceramic collectible', prompt: 'Hand-painted glazed porcelain miniature, delicate ceramic detail, subtle glossy highlights, small collectible sculpture, smooth edges, no pedestal.' },
  origami: { label: 'Origami Sculpture', description: 'Folded paper geometric art', prompt: 'Original folded origami sculpture of the exact subject, crisp paper creases, angular folded planes, vivid paper colours, soft internal shading, isolated silhouette.' },
  glass: { label: 'Art Glass', description: 'Translucent sculpted glass collectible', prompt: 'Miniature sculpted art-glass collectible, richly coloured glass with controlled refraction, bright specular highlights and recognizable solid silhouette, no external glow or pedestal.' },
} as const;
export type SpriteArtStyle = keyof typeof SPRITE_ART_STYLES;
export function isSpriteArtStyle(value: unknown): value is SpriteArtStyle {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPRITE_ART_STYLES, value);
}
export function styleDirection(style: SpriteArtStyle): string { return SPRITE_ART_STYLES[style].prompt; }
export function readPromptArtStyle(prompt: string): SpriteArtStyle {
  const value = prompt.match(/^ART STYLE ID: ([a-z]+)$/m)?.[1];
  return isSpriteArtStyle(value) ? value : 'classic';
}
export const PIXEL_STYLE_SIZES: Partial<Record<SpriteArtStyle, number>> = { classic:112, retro:64, hd:192, handheld:96, arcade:160, micro:32, gameboy:48, advance:64, furni:112, dungeon:96, cozy:64, tactics:128, neon:96, dither:96, storybook:128, metal:96 };
export function isPixelSpriteStyle(style: SpriteArtStyle): boolean { return PIXEL_STYLE_SIZES[style] !== undefined; }
export function spriteStyleSize(style: SpriteArtStyle):number { return PIXEL_STYLE_SIZES[style] ?? 512; }
