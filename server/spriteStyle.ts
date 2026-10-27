/**
 * Boop pixel sprite art-direction lock.
 *
 * Based on the four owner-supplied examples (Oct 27, 2026):
 *  - stacked burger/drink/heart icon with detailed dark pixel outlines
 *  - warm brown food object on chroma-magenta
 *  - copper-and-silver pixel harmonica on chroma-magenta
 *  - cyan-glass battery with angular gold sparkles on chroma-magenta
 *
 * Used for EVERY new Craft sprite, shiny, reroll, and provider fallback.
 * Background magenta is for chroma-key removal in the client, never the game UI.
 * Existing user-authored and cached images are left untouched.
 */
export const BOOP_SPRITE_ART_STYLE = [
  'LOCKED BOOP PIXEL ART STYLE — match the same hand-authored visual language on every future sprite.',
  'True 16-bit-style collectible inventory pixel art, NOT 3D render, vector emoji, watercolor, illustration or smooth digital painting.',
  'Use a coherent 48x48 to 64x64 LOGICAL PIXEL GRID; all edges are hard stair-step square pixels of consistent size, nearest-neighbor enlarged to the square output.',
  'IMPORTANT: thick nearly-black NAVY outer outline #1C2232 (roughly two logical pixels wide) wraps the ENTIRE subject silhouette; inner structural edges use the same deep navy. Bold silhouette is essential.',
  'Large connected blocks of saturated flat colors with 4–6 stepped shade levels per material; absolutely no soft gradients, glow, blur, brushed paint or soft antialiasing.',
  'One concentrated bright upper-left shine in small cream/white/light-cyan SQUARE pixel clusters; deep navy occlusion pixels below/inside edges, not broad airbrushed shadows.',
  'Readable miniature 2.5D depth through a subtle 3/4 view, stair-stepped bevels and overlapping chunky pixel planes, while looking firmly pixel-drawn, NOT computer-rendered.',
  'Make colors vivid and materially believable: warm toasted amber for bread, cherry red for hearts and fruit, electric cyan glass, polished pale silver/steel, rich wood/copper and vivid purple liquids where appropriate.',
  'Keep the actual subject recognizably correct and composition tight and centered; fill about 65–78% of the square canvas while leaving at least 10% outer padding.',
  'For a single named object, draw ONE object. For an explicitly named meal/set/combination, draw a SMALL cohesive cluster of the named components, overlapped in the same readable style.',
  'Do not turn unrelated concepts into the same generic gems/orbs/bottles. No anthropomorphic face on inanimate items unless the name clearly requires it.',
  'Background must be completely flat solid CHROMA #FF00FF magenta, exactly edge to edge, with NO magenta inside the subject. The game will make that background TRANSPARENT.',
  'No ground, floor, environment, shadow beneath item, UI border, text, logos, watermark, particles, atmospheric lighting or decorative backdrop.',
  'At 64px thumbnail size the subject must have an unmistakable navy-edged silhouette and bright crisp pixel clusters. Output exactly the sprite image.',
].join('\n');

/** FLUX.1 Schnell prompt is capped to 2,048 characters. */
export const BOOP_SPRITE_STYLE_COMPACT = [
  'BOOP STYLE LOCK: crisp hand-drawn 16-bit RPG item sprite; 48x48 or 64x64 logical grid, nearest-neighbor scaled. Every pixel a hard square, no soft edges.',
  'BOLD 2-pixel nearly BLACK-NAVY #1C2232 outer outline around all subject edges AND structural contours, visibly stepped pixel silhouette.',
  'Chunky vibrant flat 4-6 tone palette per material, crisp cream/white/cyan square highlights top-left, dark navy inner creases. No soft shading or gradients.',
  'Small 3/4 view and pixel-stepped bevel thickness for subtle depth, not smooth 3D. Literal accurate identifiable item; no generic orb/slime/crystal replacements.',
  'Single object unless name explicitly represents meal/set, then one tight overlapped arrangement of the named components. Center 65-78% with clear padding.',
  'Perfectly SOLID #FF00FF magenta background edge-to-edge for transparency removal; never put that magenta color inside the sprite.',
  'No text, labels, UI card, ground shadow, scenery, glow, particles, blur, logo, watermark or extra random objects.',
].join('\n');
