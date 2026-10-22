import type { Express } from 'express';
import { generateGeminiImage, publicFailure, ApiFailure, type GeminiImageResult } from './gemini.js';
import { emojiKey } from '../src/lib/emojiGeometry.js';
import { cachedWork } from './persistentCache.js';
import { clientId, takeAiBudget } from './rateLimit.js';

const SPRITE_ENGINE_VERSION = 'v9-hq-2p5d-pixel';

type ImageGenerator = (prompt: string) => Promise<GeminiImageResult>;

export function buildSpritePrompt(key: string, variation = '', shiny = false): string {
  return [
    `Create one premium pixel-art inventory sprite for this exact subject: ${JSON.stringify(key)}.`,
    shiny
      ? [
        'SHINY / ALTERNATE COLORWAY: This is a RARE SHINY variant of the SAME item, not a different subject.',
        'Change the primary and secondary pigment colors substantially from its ordinary real-world palette.',
        'Use an unmistakable alternative colorway: luminous violet/cyan/rose/gold accents selected for contrast and collector appeal.',
        'Keep the characteristic silhouette and recognizable object parts intact. Do not just add glitter or a golden border.',
        'Draw the changed pigments across the actual subject surfaces; it must look distinctly different at 48px.',
        'Use a few sharp iridescent pixel highlights only within the subject, with NO external glow or particles.',
        'Never write SHINY or any words.',
      ].join('\n')
      : '',
    variation
      ? `This is a reroll. Variation token: ${JSON.stringify(variation)}. Keep the exact subject identity and the same art direction, but change the pose, orientation, silhouette emphasis, or secondary pixel details enough to be visibly different.`
      : '',
    '',
    'REFERENCE ART DIRECTION',
    '- High-end 32-bit pixel-art inventory icon quality with a premium 2.5D game-item finish, like a polished crafting/RPG sprite sheet.',
    '- The subject is centered and large, occupying roughly 72-82% of the square canvas.',
    '- A clean, readable 1-2 logical pixel outline chosen from a DEEP SATURATED VERSION OF THE SUBJECT COLOR (e.g. navy for blue ice, forest green for leaves, dark plum for purple fabric); avoid default black or brown outlines.',
    '- COLOR IS THE HERO: use clear, luminous subject-appropriate hues and generous rich midtones. Keep about 65-75% of the visible sprite in bright or medium-light local colors, not brown/charcoal shadows.',
    '- Vibrant collectible-game palette with 4-6 clean hue-shifted color steps: saturated local color, lighter chromatic midtones, crisp highlights, and SMALL colored shadow accents; no sepia, muddy brown casts, washed-out grey, or uniformly dark exposure.',
    '- Choose colors by the literal subject: bright emerald for plants, turquoise/azure for water and ice, coral/orange/gold for flame, luminous violet for magic, clean silver-blue for metal. Earth, bark, leather, and stone can be naturally brown but should still have warm clear highlights and visible texture.',
    '- Different discoveries need visibly distinct dominant palettes; do NOT coat unrelated subjects with the same brown or dark-gold filter.',
    '- Bright, evenly legible upper-left lighting: broad illuminated midtones and crisp rectangular highlight clusters. Reserve deep shadows for narrow recesses and a small section of lower-right planes; never darken the whole sprite.',
    '- Faceted gems, crystals, metal, stone, robots, tools, plants, fossils, devices, and other objects should each use material-appropriate pixel shading.',
    '- Prefer a subtle 3/4 or isometric presentation when physically sensible: show a readable top plane plus one side/front plane so the object has real volume.',
    '- Build convincing 2.5D depth with bright pixel-stepped bevels, clean visible thickness, overlapping planes, colored edge highlights and LIMITED narrow occlusion shadows. Keep it pixel art, not smooth 3D.',
    '- Crisp hand-placed pixel clusters, not smooth vector curves, painterly brushwork, soft airbrushing, or low-detail emoji art.',
    '',
    'PIXEL GRID / QUALITY',
    '- Design on an implied 96x96 logical pixel grid, then upscale cleanly for the final 1:1 image. Use the extra resolution for richer facets, bevels, joints, cracks, material texture, and silhouette refinement.',
    '- Pixel blocks must be square and consistent in size. No anti-aliased fuzzy edges, no subpixel-looking diagonal blur, no JPEG artifacts.',
    '- Use enough internal detail to feel premium: 4-6 distinct well-lit COLOR steps, bevels, cracks, facets, seams, inset panels, reflections, joints, leaf veins, tiny edge chips, or material texture only when appropriate to the subject.',
    '- Surfaces should have intentional plane changes. Gems should show multiple facets, metal should show edge shine and recesses, stone should show depth cracks, devices should show inset screens/panels, and robots should show layered body plates and joints.',
    '- Keep details purposeful, colorful and easy to read. The sprite should look hand-authored by an experienced pixel artist, not procedurally noisy.',
    '- Avoid giant empty areas inside the subject, dark monochrome patches, and desaturated shading. Avoid oversimplified 16-bit blob silhouettes, flat front-on clip-art shapes, and single-shade interiors.',
    '',
    'SUBJECT FIDELITY',
    '- First identify the clearest literal visual interpretation of the name, then draw that.',
    '- A sword must unmistakably be a sword; dirt a mound of dirt; a robot a coherent robot; a gemstone a faceted gemstone; a fossil a fossil; a tablet/device a device.',
    '- For compound or fictional concepts, combine only the strongest recognizable visual cues into one coherent sprite.',
    '- Do not invent a crystal, orb, mascot, slime, or magic blob unless the subject actually calls for one.',
    '- Inanimate objects do not get eyes, mouths, teeth, arms, or legs unless the concept explicitly requires them.',
    '- Creatures need coherent anatomy and a normal limb count for their implied body plan unless the concept explicitly says otherwise.',
    '',
    'ANTI-AI-WEIRDNESS',
    '- No extra limbs, duplicated appendages, melted geometry, floating fragments, accidental asymmetry, random horns, gratuitous wings, human teeth, giant glassy eyes, creepy grin, or decorative clutter.',
    '- No text, letters, logos, UI frame, card border, scenery, floor, cast shadow, particles, aura, watermark-like marks, or multiple subjects.',
    '',
    'BACKGROUND',
    '- Use one perfectly flat solid #FF00FF background from edge to edge, with absolutely no gradient, noise, texture, shadow, glow, or vignette.',
    '- Do not use #FF00FF anywhere inside the sprite itself unless unavoidable; prefer nearby pinks or purples instead.',
    '- Keep at least 8% clear background padding around the sprite so it never touches the canvas edge.',
    '',
    'FINAL CHECK',
    '- The silhouette must be recognizable instantly at thumbnail size.',
    '- Final image must POP at thumbnail size: colorful polished collectible sprite, immediately readable subject colors, bright pixel clusters, crisp silhouette, layered depth, material-aware micro-detail, no muddy/sepia/dark-brown wash.',
    '- Output only the image.',
  ].filter(Boolean).join('\n');
}

function validBase64Image(result: GeminiImageResult): GeminiImageResult {
  if (!result || typeof result.data !== 'string' || typeof result.mimeType !== 'string') {
    throw new ApiFailure(502, 'The image model returned an invalid sprite.');
  }
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(result.mimeType)) {
    throw new ApiFailure(502, 'The image model returned an unsupported image type.');
  }
  if (result.data.length < 100 || result.data.length > 16_000_000 || !/^[A-Za-z0-9+/=\r\n]+$/.test(result.data)) {
    throw new ApiFailure(502, 'The image model returned invalid image data.');
  }
  return result;
}

export function registerEmojiRoute(app: Express, generateImage: ImageGenerator = generateGeminiImage) {
  const completed = new Map<string, GeminiImageResult>();
  const pending = new Map<string, Promise<GeminiImageResult>>();
  // Count real in-flight generations. The previous `pending.size` check never saw the default
  // (cached) path, so only rerolls were ever limited.
  const MAX_ACTIVE_GENERATIONS = 6;
  let active = 0;
  const generate = async (prompt: string, client: string) => {
    if (active >= MAX_ACTIVE_GENERATIONS) throw new ApiFailure(429, 'Sprite artist is busy. Try again shortly.');
    takeAiBudget(client, 5);
    active++;
    try {
      return validBase64Image(await generateImage(prompt));
    } finally {
      active--;
    }
  };

  app.post('/api/element-emoji', async (req, res) => {
    try {
      if (typeof req.body?.name !== 'string' || !req.body.name.trim() || req.body.name.length > 160) {
        throw new ApiFailure(400, 'Provide an element name under 160 characters.');
      }

      const client = clientId(req);
      const key = emojiKey(req.body.name);
      const regenerate = req.body?.regenerate === true;
      const shiny = req.body?.shiny === true;
      const variation = typeof req.body?.variation === 'string' ? req.body.variation.trim().slice(0, 64) : '';
      // Different identity at *all* cache layers, so a shiny cannot reuse or
      // overwrite the normal sprite even if both are generated concurrently.
      const cacheKey = `${SPRITE_ENGINE_VERSION}:${shiny ? 'shiny:' : ''}${key}`;
      const pendingKey = regenerate ? `${cacheKey}:regenerate:${variation || 'fresh'}` : cacheKey;

      let image = regenerate ? undefined : completed.get(cacheKey);
      if (!image) {
        if (!regenerate) {
          // Default art is generated once per engine version and then reused from Cloudflare's
          // persistent edge cache. This removes repeat image-model calls without changing art quality.
          const resolved = await cachedWork<GeminiImageResult>('element-sprite-v9', cacheKey, () => generate(buildSpritePrompt(key, '', shiny), client));
          image = validBase64Image(resolved.value);
        } else {
          // Explicit rerolls stay fresh by design. Same simultaneous reroll is still deduplicated.
          let job = pending.get(pendingKey);
          if (!job) {
            job = generate(buildSpritePrompt(key, variation, shiny), client);
            pending.set(pendingKey, job);
          }
          try {
            image = await job;
          } finally {
            pending.delete(pendingKey);
          }
        }

        // Rerolls are previews, not replacements for the canonical sprite.
        // Only default generations populate the shared in-memory cache.
        if (!regenerate) {
          if (completed.size >= 500) completed.delete(completed.keys().next().value!);
          completed.set(cacheKey, image);
        }
      }

      res.json({
        imageBase64: image.data,
        mimeType: image.mimeType,
        provenance: image.model.startsWith('@cf/')
          ? 'cloudflare-workers-ai-pixel-art'
          : image.model.startsWith('runware:')
            ? 'runware-flux-pixel-art'
            : image.model === 'muse_image'
              ? 'runway-muse-pixel-art'
              : 'gemini-native-image-pixel-art',
        model: image.model,
        engineVersion: SPRITE_ENGINE_VERSION,
        shiny,
      });
    } catch (error) {
      const failure = publicFailure(error);
      res.status(failure.status).json({ error: failure.error });
    }
  });
}
