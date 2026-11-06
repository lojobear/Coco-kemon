/**
 * Boop v17 bold collectible pixel-art style.
 *
 * Designed from the user's approved sprite example, but the example is NOT
 * transmitted as an image to the inference provider. Passing a full example
 * object as input_image_0 had caused object/content bleed between unrelated
 * generations. Describe only the visual technique and output layout here.
 * Existing player-owned artwork is never altered.
 */
export const BOOP_SPRITE_ART_STYLE = [
  'BOOP v17 BOLD COLLECTIBLE PIXEL ART, a classic polished 16-bit inventory sprite. Independently illustrate ONLY the requested named subject, without any other objects or motifs inherited from earlier images.',
  'One DISTINCT, clearly recognisable collectible item with a large, complete silhouette occupying roughly 85–95% of a square 128x128 sprite canvas, perfectly centered with a narrow transparent gutter (4–8 pixels). Avoid tiny icons and isolated fragments.',
  'Strong dark 2–4 pixel stair-stepped outer outlines with confident connected contours; three-quarter front or side viewpoint where appropriate. Crisp handmade pixel clusters indicate dimension and material, not a smooth photorealistic 3D render.',
  'Rich natural SUBJECT-SPECIFIC colour palette using roughly 24–64 flat opaque shades, with separated light/mid/dark bands, warm or cool colours as the named item requires, sharp pixel-level highlights and detailed but legible shading. Absolutely no universal colour palette or repeated body shapes.',
  'Clear anatomy, plausible functional parts, and an interesting collectible silhouette faithful to the SUBJECT DESIGN. Do not add unrelated accessories, generic platforms, cubes, plates, creatures, decorative swirls or leftovers from any prior design.',
  'ONE isolated sprite on perfectly UNIFORM solid #FF00FF magenta chroma key; absolutely no floor, frame, cast shadow, scene, writing, UI elements, other sprites or extra subjects. The app removes this chroma key to transparent pixels.',
  'Pixel-perfect hard edges only; no antialias fringe, blurred gradients, generated 3D textures, noise, detached artifacts, garbled pixels or broken black outlines.',
].join('\n');

export const BOOP_SPRITE_STYLE_COMPACT = [
  'NEW independent 128x128 BOLD 16-bit PIXEL COLLECTIBLE of the named subject only. Large centered object fills 85–95% with a narrow transparent border; no unrelated motifs from another item.',
  'Crisp thick 2–4px stair-stepped black/dark outline, vivid subject-specific palette with 24–64 flat clustered colours, dimensional hand-pixeled shading and bright sharp highlights. Charming 3/4 game-inventory presentation.',
  'No other objects, generic cubes, repeated dessert-like shapes, leftover imagery, blurry gradients, 3D render or noisy fragments. Strong recognizable subject silhouette.',
  'Pure uniform SOLID #FF00FF magenta backdrop for alpha removal; no floor, scene, cast shadow, text or label.',
].join('\n');

/**
 * Translate actions, abstract concepts and unusual discoveries into a specific
 * visual subject before asking an image model to draw the sprite.
 * An activity must never be silently depicted as a coloured cube or tile.
 */
export function spriteSubjectDirection(name: string): string {
  const value = name.trim().toLowerCase();
  if (/acoustic lantern|sound lantern|sonic lantern/i.test(value))
    return 'Depict an unmistakable hanging camping lantern: round glass chamber glowing golden-orange, metal handle arch and feet, with three tiny cyan sound-wave arcs from its vent. Clear lantern anatomy, ONE coherent centered object, not a long abstract antenna or disconnected fragments.';
  if (/echo archive|sound archive|audio archive/i.test(value))
    return 'Depict a recognizable vintage audio tape archive: ONE upright cassette with two visible circular tape reels inside a rectangular silver-grey housing and tiny cyan echo-wave lines beside it. Strong continuous outline; no horizontal noise bands, blue glitch bars, stripes or fragmented floating pieces.';
  if (/\bglassblow(?:ing|er|n)?\b|\bmolten glass\b|\bblowpipe\b/i.test(value))
    return 'Depict an actual traditional glassblowing scene as ONE coherent collectible: a long metal blowpipe held diagonally with a large glowing orange molten glass bubble at the tip, shaped into a translucent blue-green glass vase, with visible rim, neck, reflections and heat. The tube and molten glass are the focus. NOT a cube, tile, box, block, diamond or square.';
  if (/\bspace rations?\b|\bastronaut (?:meal|food)\b|\bration pack\b/i.test(value))
    return 'Depict a distinct space food ration KIT: an open silver foil pouch with visible colourful prepared food inside, a small vacuum-sealed meal packet, and compact drink sachet. Recognizable food textures, metallic seals and packet folds. NOT a flat square plate, abstract diamond, geometric slab, empty block or crate.';
  if (/\b(?:weaving|pottery|painting|blacksmithing|glassmaking|carpentry|forging|baking|fishing|gardening|mining|cooking|engraving)\b/i.test(value))
    return 'This is an ACTIVITY. Represent the activity using its most iconic real, visually identifiable tool together with a distinct finished product. E.g., pottery means potter wheel and shaped clay pot; fishing means rod and recognizable fish; baking means loaf and rolling pin. Never an abstract material cube.';
  if (/\b(?:rations?|provisions|supplies|lunch|meal|snack|breakfast|dinner)\b/i.test(value))
    return 'Depict identifiable food ingredients or a complete plated meal and its container. Show actual recognizable food, contrasting textures and distinct components. A flat generic diamond is unacceptable.';
  if (/\b(?:dream|memory|emotion|energy|knowledge|idea|thought|time|sound)\b/i.test(value))
    return 'This is an ABSTRACT IDEA. Choose an iconic pictorial metaphor with recognizably shaped real objects (e.g. hourglass for time, cassette or bell for sound, book with luminous pages for knowledge), not a cube, blob, plate, diamond or invented geometric token.';
  return 'Choose a concrete recognizable physical silhouette corresponding to the NAME, not a generic isometric cube, plate, block, prism, box, diamond or single flat geometric icon. Invent the smallest specific visual metaphor if the name is abstract.';
}

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
