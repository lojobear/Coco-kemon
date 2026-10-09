import type { Express } from 'express';
import { generateGeminiImage, publicFailure, ApiFailure, type GeminiImageResult } from './gemini.js';
import { emojiKey } from '../src/lib/emojiGeometry.js';

const SPRITE_ENGINE_VERSION = 'v9-hq-2p5d-pixel';

type ImageGenerator = (prompt: string) => Promise<GeminiImageResult>;

function buildSpritePrompt(key: string, variation = ''): string {
  return [
    `Create one premium pixel-art inventory sprite for this exact subject: ${JSON.stringify(key)}.`,
    variation
      ? `This is a reroll. Variation token: ${JSON.stringify(variation)}. Keep the exact subject identity and the same art direction, but change the pose, orientation, silhouette emphasis, or secondary pixel details enough to be visibly different.`
      : '',
    '',
    'REFERENCE ART DIRECTION',
    '- High-end 32-bit pixel-art inventory icon quality with a premium 2.5D game-item finish, like a polished crafting/RPG sprite sheet.',
    '- The subject is centered and large, occupying roughly 72-82% of the square canvas.',
    '- Strong near-black or very dark brown outer contour, usually 2-4 logical pixels thick.',
    '- Rich but controlled color ramps: dark shadow, midtone, bright local color, and small pale highlight clusters.',
    '- Lighting comes from the upper-left. Highlights are crisp rectangular pixel clusters; lower-right planes are darker.',
    '- Faceted gems, crystals, metal, stone, robots, tools, plants, fossils, devices, and other objects should each use material-appropriate pixel shading.',
    '- Prefer a subtle 3/4 or isometric presentation when physically sensible: show a readable top plane plus one side/front plane so the object has real volume.',
    '- Build convincing 2.5D depth using pixel-stepped bevels, visible thickness, overlapping planes, edge highlights, occlusion shadows, and deeper lower-right faces. Keep it pixel art, not smooth 3D.',
    '- Crisp hand-placed pixel clusters, not smooth vector curves, painterly brushwork, soft airbrushing, or low-detail emoji art.',
    '',
    'PIXEL GRID / QUALITY',
    '- Design on an implied 96x96 logical pixel grid, then upscale cleanly for the final 1:1 image. Use the extra resolution for richer facets, bevels, joints, cracks, material texture, and silhouette refinement.',
    '- Pixel blocks must be square and consistent in size. No anti-aliased fuzzy edges, no subpixel-looking diagonal blur, no JPEG artifacts.',
    '- Use enough internal detail to feel premium: 3-6 distinct value steps, bevels, cracks, facets, seams, inset panels, reflections, joints, leaf veins, tiny edge chips, or material texture only when appropriate to the subject.',
    '- Surfaces should have intentional plane changes. Gems should show multiple facets, metal should show edge shine and recesses, stone should show depth cracks, devices should show inset screens/panels, and robots should show layered body plates and joints.',
    '- Keep details purposeful. The sprite should look hand-authored by an experienced pixel artist, not procedurally noisy.',
    '- Avoid giant empty areas inside the subject. Avoid oversimplified 16-bit blob silhouettes, flat front-on clip-art shapes, and single-shade interiors.',
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
    '- The result should look substantially more polished and detailed than a simple generated emoji or code-drawn vector: premium collectible sprite quality, crisp silhouette, layered depth, and material-aware micro-detail.',
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

  app.post('/api/element-emoji', async (req, res) => {
    try {
      if (typeof req.body?.name !== 'string' || !req.body.name.trim() || req.body.name.length > 160) {
        throw new ApiFailure(400, 'Provide an element name under 160 characters.');
      }

      const key = emojiKey(req.body.name);
      const regenerate = req.body?.regenerate === true;
      const variation = typeof req.body?.variation === 'string' ? req.body.variation.trim().slice(0, 64) : '';
      const cacheKey = `${SPRITE_ENGINE_VERSION}:${key}`;
      const pendingKey = regenerate ? `${cacheKey}:regenerate:${variation || 'fresh'}` : cacheKey;

      let image = regenerate ? undefined : completed.get(cacheKey);
      if (!image) {
        let job = pending.get(pendingKey);
        if (!job) {
          if (pending.size >= 6) throw new ApiFailure(429, 'Sprite artist is busy. Try again shortly.');
          job = generateImage(buildSpritePrompt(key, variation)).then(validBase64Image);
          pending.set(pendingKey, job);
        }

        try {
          image = await job;
        } finally {
          pending.delete(pendingKey);
        }

        if (completed.size >= 500) completed.delete(completed.keys().next().value!);
        completed.set(cacheKey, image);
      }

      res.json({
        imageBase64: image.data,
        mimeType: image.mimeType,
        provenance: image.model.startsWith('@cf/')
          ? 'cloudflare-workers-ai-pixel-art'
          : 'gemini-native-image-pixel-art',
        model: image.model,
        engineVersion: SPRITE_ENGINE_VERSION,
      });
    } catch (error) {
      const failure = publicFailure(error);
      res.status(failure.status).json({ error: failure.error });
    }
  });
}
