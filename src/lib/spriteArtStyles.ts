/** Shared allowlist: styles affect explicit edits only, never automatic discoveries. */
export const SPRITE_ART_STYLES = {
  classic: { label: 'Classic Boop', description: 'Compact isometric furni pixel art', prompt: '' },
  retro: { label: 'Retro 16-bit', description: 'Chunky pixels, classic RPG palette', prompt: 'Classic 16-bit RPG inventory pixel art; chunky square pixel clusters, limited 16–24 color palette, strong silhouette, stepped shadows, crisp hard edges. No gradients.' },
  hd: { label: 'HD Pixel Art', description: 'Fine pixels, richer textures', prompt: 'High-definition pixel art inventory icon; fine crisp pixel clusters, rich material texture, precise highlights, detailed readable silhouette, no smooth gradients or anti-aliasing.' },
  glossy: { label: 'Glossy 3D', description: 'Polished collectible toy render', prompt: 'Polished stylized 3D collectible inventory icon, smooth rounded surfaces, glossy material highlights, subtle ambient occlusion within the object, clean studio lighting, no pixelation or outline.' },
  chibi: { label: 'Chibi', description: 'Cute rounded proportions', prompt: 'Chibi collectible icon, cute compact proportions, soft rounded shapes, expressive anatomy for living subjects only, clean outlines and smooth pastel cel shading; no pixelation.' },
  illustrated: { label: 'Illustrated', description: 'Hand-drawn lines and cel shading', prompt: 'Hand-drawn fantasy inventory illustration, confident ink contours, crisp cel shading, rich colors and recognizable material detail, smooth edges, no pixelation.' },
  handheld: { label: 'Handheld Monster Pixel', description: 'Expressive collectible sprites with crisp outlines', prompt: 'Original handheld monster-collecting RPG inventory sprite, clean 1–2 pixel dark outlines, saturated local colours, compact expressive silhouette, crisp stepped highlights and shadows; no text or franchise branding.' },
  arcade: { label: 'Arcade 32-bit', description: 'Bold arcade shading and punchy colours', prompt: 'Detailed 32-bit arcade game inventory sprite, punchy contrast, clean stepped pixel clusters, saturated colours, dramatic readable highlights, no blurred gradients.' },
  voxel: { label: 'Voxel 3D', description: 'Chunky miniature cube-built model', prompt: 'Isometric miniature voxel sculpture made of tiny coloured cubes, block-built geometry, crisp stepped silhouettes, soft ambient occlusion between cubes, collectible game icon.' },
  clay: { label: 'Soft Clay', description: 'Handmade stop-motion clay miniature', prompt: 'Handcrafted miniature clay sculpture, tactile polymer clay, subtly rounded forms, gentle fingerprints and soft studio shading, charming collectible icon, smooth edges.' },
  plush: { label: 'Plush Toy', description: 'Soft fabric, stitches and embroidery', prompt: 'Adorable collectible plush toy rendition, soft fabric texture, neat embroidered or stitched details, rounded stuffed shapes, clean isolated silhouette, studio lighting.' },
  enamel: { label: 'Enamel Pin', description: 'Metal outlines and glossy enamel', prompt: 'Premium collectible hard-enamel pin, polished metal borders separating rich flat enamel colours, clean graphic silhouette, subtle metallic highlights, no typography.' },
  sticker: { label: 'Vinyl Sticker', description: 'Bold graphic art with white die-cut edge', prompt: 'Premium die-cut vinyl sticker illustration, bold clean line art, vivid flat colour and controlled cel shadows, narrow white outline around the entire subject, no words.' },
  comic: { label: 'Comic Book', description: 'Ink outlines and dramatic cel shading', prompt: 'Dynamic comic-book inventory illustration, confident black ink contour lines, rich cel shading, selective halftone texture, clear recognisable silhouette, no captions or panel.' },
  watercolor: { label: 'Watercolour', description: 'Delicate painted texture and soft edges', prompt: 'Hand-painted watercolour collectible icon, controlled pigment blooms inside the subject, delicate linework, soft natural colour variation, clean cutout silhouette, no paper texture outside subject.' },
  papercraft: { label: 'Papercraft', description: 'Layered cut-paper miniature', prompt: 'Layered handmade cut-paper sculpture, crisp cut edges, folded paper facets, colourful stacked layers, subtle internal shadows, isolated miniature with readable silhouette.' },
  figurine: { label: 'Collector Figurine', description: 'Premium sculpted resin collectible', prompt: 'Premium painted resin collectible figurine, precisely sculpted surface details, realistic material-specific highlights, miniature toy proportions, studio render with no pedestal or cast shadow.' },
  blueprint: { label: 'Blueprint Icon', description: 'Technical line-art collectible', prompt: 'Clean technical blueprint-inspired icon of the exact subject, precise navy and cyan contour lines and restrained diagrammatic details, no labels, numbers, grid, frame or background; clear silhouette.' },
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

/** Preserve smooth artwork; pixel styles alone use nearest-neighbour quantization. */
export function isPixelSpriteStyle(style: SpriteArtStyle): boolean {
  return style === 'classic' || style === 'retro' || style === 'hd' || style === 'handheld' || style === 'arcade';
}
