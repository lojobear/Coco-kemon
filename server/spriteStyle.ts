/**
 * Original isometric virtual-hotel furniture / collectible sprite direction.
 * Inspired by the visual vocabulary of classic Habbo Hotel furni, not copied
 * from its proprietary sprite assets.
 *
 * The subject determines silhouette, material and colour. Shared style must
 * NEVER turn unrelated discoveries into the same brown wooden item.
 */
export const BOOP_SPRITE_ART_STYLE = [
  'STYLE: original classic virtual-hotel FURNI / early-2000s social-room pixel art, like the tiny individually designed collectible furnishings in Habbo Hotel.',
  'Render the EXACT named discovery as its own unique recognizable OBJECT, creature, food or collectible. The name decides what it looks like. Do NOT turn arbitrary concepts into generic furniture, wooden chests, relics, mugs, boxes or machines.',
  'Clean orthographic ISOMETRIC 2:1 pixel-art perspective for solid objects: top surfaces as diamonds, left and right faces visibly distinct, parallel pixel stair-step edges. Not a front-facing emoji, not a perspective photograph, not a low-poly 3D render.',
  'For subjects that are naturally flat/round/organic or alive, keep their true anatomy and use a matching 3/4 virtual-world sprite angle rather than forcing every form into a square box.',
  'Precise hand-placed 1-pixel stair-stepped silhouettes and interior details. Thin 1-pixel DARKER-LOCAL-COLOUR outlines, not a heavy identical black/navy cartoon border on every object.',
  'Light enters from the upper left: top plane slightly lighter, left face midtone, right/back face darker. Shade by simple contiguous groups of 4-7 crisp flat colours per MATERIAL. Subtle realistic pixel thickness and carefully chosen material textures.',
  'COLOR DIVERSITY MATTERS MORE THAN A SHARED PALETTE. Choose the true saturated colours of EACH subject, not a universal brown, tan, ochre, amber, copper, sepia or navy overlay. Most non-wooden sprites must contain NO brown at all.',
  'Examples of correctly different materials: leaf = saturated green; water/ice = blue/cyan; magic = purple/pink; fire = scarlet/orange; metal = silver/slate; glass = cyan/white; food = its true ingredients; electronic device = appropriate plastic/screen colours; wood ONLY if named item actually has wood.',
  'Each discovery needs a distinctly different silhouette, geometry and material response. A mushroom is not a brown generic chest; a river is not a brown orb; a battery is not a wooden relic.',
  'Miniature furni-catalog scale: one well-designed isolated object, 72-84% of frame; enough surrounding air for a distinct silhouette. Items are collectible, not scene illustrations. Show 3D volume without excessive bevels.',
  'Flat, readable, cheerful and clean. No excessive highlights, glows, glitter, muddy shadow fill, gritty noise, heavy gradients, ambient occlusion, photoreal texture or fake 3D render.',
  'Output on a single completely uniform SOLID #FF00FF chroma-magenta background. No pink/magenta inside the item; the client removes the background to transparency.',
  'No floor tile, stand, stage, cast shadow, scene, UI card, text, letters, watermark, border, extra unrelated props, repeated subject or logo.',
  'Draw an ORIGINAL isometric collectible in that visual genre. Do not duplicate any existing Habbo sprite design.',
].join('\n');

/** FLUX.1 Schnell is restricted to 2,048 characters. */
export const BOOP_SPRITE_STYLE_COMPACT = [
  'Original classic Habbo Hotel FURNI-like isometric pixel art. Accurate exact SUBJECT, unique silhouette, not a generic chest, brown relic, wooden box or orb.',
  'Clean orthographic 2:1 isometric view: stepped pixel diagonal diamond top, visible side faces; organic/creature anatomy preserved in 3/4 view.',
  'Fine one-pixel subject-colour outlines, crisp hand-placed square pixels; 4-7 flat material-specific colours. Top plane brighter, side planes gradually darker. Not huge dark borders, not smooth 3D.',
  'VIBRANT TRUE SUBJECT COLOURS. No shared brown, sepia, copper or ochre cast. Wood may be brown ONLY if the exact object is wooden. Blues for water, greens for plants, silver for metal, red for berries, etc.',
  'Every element looks distinct; capture distinctive named parts and material, not a reused template. One centered collectible filling 72-84% of canvas.',
  'Perfectly flat SOLID #FF00FF magenta chroma background for transparency removal, never magenta inside subject.',
  'No floor, ground shadow, text, cards, extra objects, blur, painterly gradients, glow, low-poly render or logos.',
].join('\n');

/**
 * The model must not interpret the old brown references as a universal palette.
 * These instructions come from the actual NAME, with a varied deterministic
 * accent for strange/fictional names that do not fit a known material.
 */
const PALETTE_RULES: Array<{ matches: RegExp; direction: string }> = [
  { matches: /\b(?:forest|tree|leaf|plant|grass|moss|fern|ivy|cactus|herb|vine|jungle|flower)\b/i,
    direction: 'Vegetation should be lush emerald, lime, jade or mint, with distinct leaf shapes and perhaps naturally-coloured blossoms; never recolour the foliage brown.' },
  { matches: /\b(?:water|sea|ocean|rain|river|pond|lake|ice|frost|snow|glacier|cloud|mist|steam|wave)\b/i,
    direction: 'Aquatic or ice elements: crisp azure, teal, turquoise, cobalt or icy white. Use transparent-looking cool shaded planes; avoid any tan or brown.' },
  { matches: /\b(?:flame|fire|lava|ember|sun|solar|inferno|volcano|magma|heat)\b/i,
    direction: 'Heat and fire: hot scarlet, red-orange, vivid yellow with small bright centres; no universal brown shadow wash.' },
  { matches: /\b(?:tech|robot|cyber|machine|screen|phone|console|computer|battery|radio|electric|laser|pixel|arcade|digital)\b/i,
    direction: 'Tech and electronics: cool silver/graphite casing plus unique glowing cyan, royal blue, vivid red or green parts. Do not substitute wood or copper casing.' },
  { matches: /\b(?:gem|jewel|ruby|sapphire|emerald|diamond|crystal|magic|spell|wizard|potion|nebula|galaxy|cosmic|star)\b/i,
    direction: 'Magical/crystalline: rich saturated purple, sapphire, fuchsia, turquoise or bright gemstone hues with clean angular facets; no brown by default.' },
  { matches: /\b(?:berry|cherry|strawberry|apple|tomato|heart|rose|pepper)\b/i,
    direction: 'Fruit or red-flower elements: glossy cherry red, coral, ruby or leaf green with light peach highlights; never beige by default.' },
  { matches: /\b(?:metal|steel|iron|chrome|silver|aluminum|aluminium|glass|mirror|ceramic)\b/i,
    direction: 'Metal, glass and ceramics: pale silver, blue-gray, turquoise or clean white highlights appropriate to the actual material, not a brown tint.' },
  { matches: /\b(?:bread|toast|burger|steak|chocolate|wood|treehouse|oak|log|leather|coffee|biscuit)\b/i,
    direction: 'Use warm brown ONLY on naturally brown ingredients or named wood/leather, with other ingredients in their true independent bright colours (tomato red, lettuce green, cheese yellow).' },
];
const INVENTED_PALETTES = [
  'Distinct bright cyan and midnight teal with a little clean white',
  'Distinct coral-pink and vivid raspberry with a warm cream highlight',
  'Distinct electric indigo and violet with light lilac highlights',
  'Distinct jade green and chartreuse with a cool ivory highlight',
  'Distinct cobalt blue and golden yellow with clean silver accents',
  'Distinct fresh turquoise and tomato-red with light sky-blue accents',
  'Distinct rosy magenta and pale blue with cool pearl highlights',
  'Distinct ultramarine and mint green with white highlights',
];

/** Palette is varied by name but must not override the real identity/material. */
export function spriteColorDirection(name: string): string {
  const normalized = name.trim().toLowerCase();
  const matching = PALETTE_RULES.find(rule => rule.matches.test(normalized));
  if (matching) return matching.direction;
  let hash = 2166136261;
  for (const char of normalized) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const palette = INVENTED_PALETTES[(hash >>> 0) % INVENTED_PALETTES.length];
  return `For an invented or ambiguous concept, choose the object's natural palette first; use ${palette} as a distinct accent only if it suits the subject. Do NOT make it brown by default.`;
}
