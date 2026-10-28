import type { Express } from 'express';
import { generateGeminiImage, publicFailure, ApiFailure, type GeminiImageResult } from './gemini.js';
import { emojiKey } from '../src/lib/emojiGeometry.js';
import { cachedWork } from './persistentCache.js';
import { clientId, takeAiBudget } from './rateLimit.js';
import { BOOP_SPRITE_ART_STYLE, spriteColorDirection } from './spriteStyle.js';

// New model generations use the locked pixel style. Existing local/owned art remains saved.
const SPRITE_ENGINE_VERSION = 'v12-bold-clean-furni';

type ImageGenerator = (prompt: string) => Promise<GeminiImageResult>;

export function buildSpritePrompt(key: string, variation = '', shiny = false): string {
  return [
    `Create one premium pixel-art inventory sprite for this exact subject: ${JSON.stringify(key)}.`,
    `SUBJECT-BASED PALETTE: ${spriteColorDirection(key)}`,
    shiny
      ? [
        'SHINY / ALTERNATE COLORWAY: This is a RARE SHINY variant of the SAME item, not a different subject.',
        'Change the primary and secondary pigment colors substantially from its ordinary real-world palette.',
        'Use an unmistakable alternative colorway: luminous violet/cyan/rose/gold accents selected for contrast and collector appeal.',
        'Keep the characteristic silhouette and recognizable object parts intact. Do not just add glitter or a golden border.',
        'Draw the changed pigments across the actual subject surfaces; it must look distinctly different at thumbnail size.',
        'Use a few sharp iridescent pixel highlights only within the subject, with NO external glow or particles.',
        'Never write SHINY or any words.',
      ].join('\n')
      : '',
    variation
      ? `This is a reroll. Variation token: ${JSON.stringify(variation)}. Keep the exact subject identity and the same art direction, but change the pose, orientation, silhouette emphasis, or secondary pixel details enough to be visibly different.`
      : '',
    '',
    BOOP_SPRITE_ART_STYLE,
    '',
    'SUBJECT FIDELITY',
    '- First identify the clearest literal visual interpretation of the name, then draw that.',
    '- A sword must unmistakably be a sword; dirt a mound of dirt; a robot a coherent robot; a gemstone a faceted gemstone; a fossil a fossil; a tablet/device a device.',
    '- For compound or fictional concepts, combine only the strongest recognizable visual cues into one coherent sprite.',
    '- Do not invent a crystal, orb, mascot, slime, or magic blob unless the subject actually calls for one.',
    '- Inanimate objects do not get eyes, mouths, teeth, arms, or legs unless the concept explicitly requires them.',
    '- Creatures need coherent anatomy and a normal limb count for their implied body plan unless the concept explicitly says otherwise.',
    '',
    'FINAL CHECK',
    '- Quality gate: bold continuous 1-2-pixel darker-local-colour silhouette contours, vivid planes, solid unbroken geometry, absolutely no detached glitched pixels, corrupted seams or torn edges.',
    '- Do not use any single universal palette, brown filter or reused silhouette: every discovered item must look like its uniquely named subject.',
    '- Output image only.',
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
