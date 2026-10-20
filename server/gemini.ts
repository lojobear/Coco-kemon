import { GoogleGenAI } from '@google/genai';
import { conceptDNAFor } from './discovery.js';
import { getWorkersAiBinding } from './workersAi.js';
import { generateRunwareSprite } from './runware.js';

export class ApiFailure extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function publicFailure(error: unknown): { status: number; error: string } {
  return error instanceof ApiFailure
    ? { status: error.status, error: error.message }
    : { status: 502, error: 'The AI returned an invalid result. Please retry.' };
}

function sanitizeModel(name?: string): string | null {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.startsWith('AQ.') || (trimmed.startsWith('AI') && trimmed.length > 30)) return null;
  if (/^(models\/)?gemini-[a-z0-9.-]+/i.test(trimmed)) return trimmed;
  return null;
}

/** Shared with health reporting so the displayed model order is truthful. */
export function getGeminiModels(): string[] {
  return Array.from(new Set([
    sanitizeModel(process.env.GEMINI_MODEL),
    sanitizeModel(process.env.GEMINI_FALLBACK_MODEL),
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ].filter((model): model is string => Boolean(model)))).slice(0, 2);
}

function terminalGeminiFailure(error: unknown): ApiFailure | null {
  const value = error as { status?: number; code?: number } | null;
  const code = Number(value?.status || value?.code);
  if (code === 429) return new ApiFailure(429, 'Gemini quota reached. Please wait a moment before retrying.');
  if (code === 401 || code === 403) return new ApiFailure(503, 'Gemini API key is invalid or unauthorized. Please verify your key.');
  return null;
}

const DISCOVERY_CONNECTIONS = [
  'science', 'function', 'appearance', 'mythology', 'wordplay',
  'chemistry', 'physics', 'biology', 'ecology', 'technology',
  'history', 'geography', 'food', 'pop-culture', 'brand',
  'character', 'comedy', 'language',
];

const DISCOVERY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'Concise discovery name, usually one to three words.' },
          emoji: { type: 'string', description: 'One expressive emoji for the discovery.' },
          connection: { type: 'string', enum: DISCOVERY_CONNECTIONS, description: 'Best descriptive route label only; this label must never limit what the actual result can be.' },
          explanation: { type: 'string', description: 'One concise player-facing sentence explaining the causal bridge from both inputs to the result.' },
          coherence: { type: 'integer', minimum: 1, maximum: 5 },
          surprise: { type: 'integer', minimum: 1, maximum: 5 },
          inputFit: { type: 'integer', minimum: 1, maximum: 5, description: 'How strongly BOTH inputs are necessary to the result.' },
          recognizability: { type: 'integer', minimum: 1, maximum: 5, description: 'How immediately understandable or nameable the result is.' },
          chainPotential: { type: 'integer', minimum: 1, maximum: 5, description: 'How useful this concept is for many future combinations.' },
          novelty: { type: 'integer', minimum: 1, maximum: 5, description: 'How distinct this idea is from generic mashups without sacrificing coherence.' },
        },
        required: ['result', 'emoji', 'connection', 'explanation', 'coherence', 'surprise', 'inputFit', 'recognizability', 'chainPotential', 'novelty'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
};

const FOUNDRY_IDEA_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      minItems: 4,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Specific collectible result name, usually one to four words.' },
          domain: { type: 'string', description: 'Free-form semantic domain; do not choose from a fixed taxonomy.' },
          explanation: { type: 'string', description: 'One concise sentence showing how both inputs and the process lead to this result.' },
          inputFit: { type: 'integer', minimum: 1, maximum: 5 },
          processFit: { type: 'integer', minimum: 1, maximum: 5 },
          recognizability: { type: 'integer', minimum: 1, maximum: 5 },
          novelty: { type: 'integer', minimum: 1, maximum: 5 },
          chainPotential: { type: 'integer', minimum: 1, maximum: 5 },
        },
        required: ['name', 'domain', 'explanation', 'inputFit', 'processFit', 'recognizability', 'novelty', 'chainPotential'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
};

type FoundryIdea = {
  name: string;
  domain: string;
  explanation: string;
  inputFit: number;
  processFit: number;
  recognizability: number;
  novelty: number;
  chainPotential: number;
};

function isDiscoveryInstruction(systemInstruction?: string): boolean {
  return Boolean(systemInstruction?.includes('playful conceptual crafting game'));
}

function isFoundryPrompt(prompt: string | { parts: any[] }): prompt is string {
  return typeof prompt === 'string' && prompt.includes('synthesis engine for ODDKIN FOUNDRY');
}

const OVERUSED_ROOTS = [
  'ferro', 'ferri', 'steel', 'alloy', 'crystal', 'quantum', 'nano', 'neo', 'proto',
  'aether', 'void', 'stellar', 'cosmic', 'lunar', 'solar', 'pyro', 'cryo', 'hydro',
  'electro', 'bio', 'geo', 'chrono', 'magma', 'plasma', 'matrix', 'core', 'shard',
];

function extractExistingMaterialNames(prompt: string): string[] {
  const match = prompt.match(/EXISTING DISCOVERED MATERIALS:\s*([^\n]*)/i);
  if (!match?.[1]) return [];
  return match[1].split(',').map(name => name.trim()).filter(Boolean).slice(-40);
}

function findOverusedRoots(names: string[]): string[] {
  const lowered = names.map(name => name.toLowerCase());
  return OVERUSED_ROOTS.filter(root => lowered.filter(name => name.includes(root)).length >= 2);
}

function normalizeWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
}

function lexicalSimilarity(a: string, b: string): number {
  const aa = new Set(normalizeWords(a));
  const bb = new Set(normalizeWords(b));
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const word of aa) if (bb.has(word)) overlap += 1;
  return overlap / Math.max(aa.size, bb.size);
}

function isValidFoundryIdea(value: unknown): value is FoundryIdea {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const idea = value as Record<string, unknown>;
  return ['name', 'domain', 'explanation'].every(k => typeof idea[k] === 'string' && String(idea[k]).trim()) &&
    ['inputFit', 'processFit', 'recognizability', 'novelty', 'chainPotential'].every(k =>
      typeof idea[k] === 'number' && Number.isFinite(idea[k]) && Number(idea[k]) >= 1 && Number(idea[k]) <= 5
    );
}

function scoreFoundryIdea(idea: FoundryIdea, existingNames: string[], overusedRoots: string[]): number {
  let score =
    idea.inputFit * 5 +
    idea.processFit * 5 +
    idea.recognizability * 2 +
    idea.novelty * 2 +
    idea.chainPotential * 3;

  const lowerName = idea.name.toLowerCase();
  if (existingNames.some(name => name.toLowerCase() === lowerName)) score -= 35;

  const closest = existingNames.reduce((max, name) => Math.max(max, lexicalSimilarity(idea.name, name)), 0);
  score -= closest * 18;

  if (overusedRoots.some(root => lowerName.includes(root))) score -= 22;
  if (/^(ultra|hyper|mega|neo|proto|quantum|cosmic|aether|ferro)[ -]/i.test(idea.name)) score -= 10;
  if (/(alloy|matrix|core|shard|crystal)$/i.test(idea.name)) score -= 8;

  const nameWords = normalizeWords(idea.name).length;
  if (nameWords >= 1 && nameWords <= 4) score += 3;
  if (idea.inputFit >= 4 && idea.processFit >= 4) score += 8;

  return score;
}

function compactFoundryContext(prompt: string): string {
  const inputA = prompt.match(/INPUT A:[\s\S]*?(?=\n\nINPUT B:)/)?.[0] || '';
  const inputB = prompt.match(/INPUT B:[\s\S]*?(?=\n\nAPPLIED PROCESS:)/)?.[0] || '';
  const process = prompt.match(/APPLIED PROCESS:[^\n]*/)?.[0] || '';
  const depth = prompt.match(/CURRENT RECIPE DEPTH:[^\n]*/)?.[0] || '';
  const existing = prompt.match(/EXISTING DISCOVERED MATERIALS:[^\n]*/)?.[0] || '';
  return [inputA, inputB, process, depth, existing].filter(Boolean).join('\n');
}

async function searchFoundryIdeas(
  ai: Pick<GoogleGenAI, 'models'>,
  model: string,
  prompt: string
): Promise<FoundryIdea | null> {
  const existingNames = extractExistingMaterialNames(prompt);
  const overusedRoots = findOverusedRoots(existingNames);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  const ideaPrompt = `You are the concept-search stage for an infinite crafting game.\n\n${compactFoundryContext(prompt)}\n\nGenerate six genuinely different plausible outcomes before any detailed object schema is written. Start from the causal meaning of BOTH inputs and the applied process. Do not choose a genre or domain first. The semantic connection determines the domain.\n\nThe result may be anything that forms a useful, recognizable node in an endless discovery graph: a real object, food, tool, gadget, vehicle, toy, wearable, cultural reference, fictional object or character, natural object, scientific phenomenon, place, creature-adjacent concept, fantasy artifact, joke, internet reference, or a coherent original collectible. This list is illustrative, never exhaustive.\n\nPop culture is welcome only when the recipe genuinely points there. Prefer specific recognizable nouns over pseudo-scientific filler. Avoid cosmetic cousins of recent discoveries and especially avoid repeated Ferro/Alloy/Crystal/Quantum/Core/Shard/Matrix naming families unless chemically or semantically unavoidable.\n\nA strong candidate must satisfy three tests: (1) both inputs visibly matter, (2) the process is the reason the transformation makes sense, and (3) the result creates useful possibilities for future combinations. Score each candidate honestly. Explanations must be short player-facing connections, not private reasoning. Return JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: ideaPrompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: FOUNDRY_IDEA_SCHEMA,
        temperature: 0.9,
        abortSignal: controller.signal,
        httpOptions: { timeout: 3000 },
      } as any,
    });
    const raw = response.text?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ideas = Array.isArray(parsed?.candidates) ? parsed.candidates.filter(isValidFoundryIdea) : [];
    if (!ideas.length) return null;
    ideas.sort((a: FoundryIdea, b: FoundryIdea) =>
      scoreFoundryIdea(b, existingNames, overusedRoots) - scoreFoundryIdea(a, existingNames, overusedRoots)
    );
    const winner = ideas[0];
    if (!winner || winner.inputFit < 3 || winner.processFit < 3) return null;
    return winner;
  } catch (error) {
    const terminal = terminalGeminiFailure(error);
    if (terminal) throw terminal;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function enhanceFoundryPrompt(prompt: string, selectedIdea?: FoundryIdea | null): string {
  const existingNames = extractExistingMaterialNames(prompt);
  const overusedRoots = findOverusedRoots(existingNames);
  const recentNames = existingNames.slice(-15).join(', ') || 'none';
  const suppressed = overusedRoots.length ? overusedRoots.join(', ') : 'none detected';
  const selected = selectedIdea
    ? `\nTHOUGHTFUL CONCEPT SEARCH RESULT (binding unless it conflicts with a hard physical/property constraint):\n- Result concept: ${selectedIdea.name}\n- Natural domain: ${selectedIdea.domain}\n- Why it works: ${selectedIdea.explanation}\n- Candidate scores: input fit ${selectedIdea.inputFit}/5, process fit ${selectedIdea.processFit}/5, recognizability ${selectedIdea.recognizability}/5, novelty ${selectedIdea.novelty}/5, future-chain potential ${selectedIdea.chainPotential}/5.\nBuild the final material/object around this concept. Preserve the selected name unless a tiny grammatical normalization is needed.`
    : `\nThe fast concept-search stage was unavailable. Before answering, compare several genuinely different candidate outcomes internally and choose the one with the best combination of input fit, process fit, recognizability, novelty, and future-chain potential. Return only the final JSON, not the candidate comparison.`;

  return `${prompt}${selected}\n\nFOUNDRY GENERATION PRINCIPLES:\n- This is an effectively unbounded semantic crafting graph, not a finite recipe list. Do not force results into a fixed taxonomy. Any concrete or culturally recognizable noun can become a collectible if the recipe earns it.\n- NEVER choose a domain first and then force the ingredients into it. Start with what the two inputs mean and what the process actually does; the result's domain should emerge from that causal relationship.\n- Exact recipes should remain reproducible, but unexplored recipes and deeper descendants must be free to create genuinely new semantic branches.\n- The output does not need to be a raw substance. It can be an object, artifact, food, gadget, toy, tool, vehicle, wearable, place-like collectible, cultural reference, fantasy item, fictional object/character, natural object, scientific concept, joke, or something outside those examples.\n- Pop culture is explicitly welcome when both ingredients and the process make the reference understandable. Do not insert a celebrity, franchise, meme, character, brand, or title merely because it is recognizable.\n- Prefer the simplest specific name a player would naturally use. Choose “Flashlight” over “Electro-Lumen Alloy” when flashlight is what the recipe actually implies.\n- Reject pseudo-scientific filler, generic adjective+noun mashups, and repeated naming families. Recent names: ${recentNames}. Overused roots to suppress: ${suppressed}.\n- If a recent result already occupies the same semantic idea, either reuse that canonical idea only when truly identical or choose a meaningfully different branch—not a synonym with a new prefix.\n- Depth represents accumulated lineage, not automatic weirdness. Deep recipes can still produce ordinary recognizable things; strange results need a strange causal chain.\n- Keep the result highly recombinable. A good discovery should suggest many future pairings instead of being a dead-end flavor phrase.\n- For non-living discoveries, category may be any concise useful classification (for example Artifact, Food, Technology, Tool, Toy, Vehicle, Wearable, Cultural, Natural, Fantasy, Composite, Mineral, Elemental, Organic, Metallic, Energy, Biological, or something more fitting). State and boolean properties must still match what the result physically represents.\n- The player's reaction target is usually “oh, of course” and sometimes “that's clever,” not “the AI made up another sci-fi material.”`;
}

function enhanceDiscoveryInstruction(systemInstruction: string): string {
  return `${systemInstruction}

QUALITY CHECK:
- Produce four genuinely DIFFERENT semantic bridges, not trivial variations
  of one noun. Keep output concise and parseable, especially on small models.
- Use actual functions, material interactions, biology, myths, idioms, culture,
  place names or history where both inputs meaningfully contribute.
- Reject results that merely name one input's synonym ("BBQ" => "Grill"), give
  a parent a costume ("Worm-Shaped Cloud"), or join the parent words together.
- Name an independent, recognizable thing—not an adjective plus the parent.
- The result may be everyday, strange, fictional or funny; always prioritize
  a satisfying two-parent connection over weirdness for its own sake.
- Explain each outcome in ONE short, player-facing sentence mentioning BOTH
  inputs by name. Do not provide private reasoning.
- Scores must reflect real two-parent fit, not self-congratulation.
- Return a JSON object with exactly four concise candidates.`;
}

function enrichDiscoveryPrompt(prompt: string | { parts: any[] }): string | { parts: any[] } {
  if (typeof prompt !== 'string') return prompt;
  const prefix = 'Find satisfying discoveries for these input names:';
  const index = prompt.indexOf(prefix);
  if (index < 0) return prompt;

  const raw = prompt.slice(index + prefix.length).trim();
  try {
    const names = JSON.parse(raw);
    if (!Array.isArray(names) || names.length !== 2 || names.some(name => typeof name !== 'string')) return prompt;
    const known = names.map((name: string) => ({ name, dna: conceptDNAFor(name) || null }));
    const inheritance = known.some((entry: { dna: unknown }) => entry.dna)
      ? `\nKnown semantic parent metadata from earlier discoveries: ${JSON.stringify(known)}\nUse this only as grounded lineage context. Preserve meaningful inherited functions/properties while still allowing a natural cross-domain result.`
      : '';
    return `${prompt}${inheritance}\nBefore proposing candidates, infer several plausible relationships between the two inputs. Do not commit to a domain first. Produce diverse outcomes that each use a different meaningful bridge, and make each explanation explicit enough for the server to verify both-parent contribution.`;
  } catch {
    return prompt;
  }
}

let client: GoogleGenAI | undefined;

export type GeminiImageResult = {
  data: string;
  mimeType: string;
  model: string;
};

export function getGeminiImageModels(): string[] {
  return Array.from(new Set([
    sanitizeModel(process.env.GEMINI_IMAGE_MODEL),
    // Use low-latency generateContent image models by default; allow an explicit override.
    'gemini-3.1-flash-lite-image',
    'gemini-3.1-flash-image',
  ].filter((model): model is string => Boolean(model)))).slice(0, 2);
}

function bytesToBase64(bytes: Uint8Array): string {
  // Workers with nodejs_compat expose Buffer; browsers/tests can fall back to btoa.
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function normalizeWorkersImagePayload(payload: any): Promise<{ data: string; mimeType: string } | null> {
  if (!payload) return null;

  if (typeof payload === 'object' && !(payload instanceof ArrayBuffer) && !ArrayBuffer.isView(payload)) {
    const nested = payload.image ?? payload.data ?? payload.result?.image ?? payload.result?.data ?? payload.output?.image;
    if (nested && nested !== payload) return normalizeWorkersImagePayload(nested);
  }

  if (typeof payload === 'string') {
    const dataUrl = payload.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is);
    if (dataUrl) return { mimeType: dataUrl[1], data: dataUrl[2].replace(/\s+/g, '') };
    const compact = payload.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length >= 100) {
      return { data: compact, mimeType: 'image/png' };
    }
    return null;
  }

  if (payload instanceof ArrayBuffer) {
    return { data: bytesToBase64(new Uint8Array(payload)), mimeType: 'image/png' };
  }

  if (ArrayBuffer.isView(payload)) {
    const bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
    return { data: bytesToBase64(bytes), mimeType: 'image/png' };
  }

  if (typeof Blob !== 'undefined' && payload instanceof Blob) {
    return {
      data: bytesToBase64(new Uint8Array(await payload.arrayBuffer())),
      mimeType: payload.type || 'image/png',
    };
  }

  if (typeof Response !== 'undefined' && payload instanceof Response) {
    const mimeType = payload.headers.get('content-type')?.split(';')[0] || 'image/png';
    return { data: bytesToBase64(new Uint8Array(await payload.arrayBuffer())), mimeType };
  }

  if (typeof ReadableStream !== 'undefined' && payload instanceof ReadableStream) {
    return {
      data: bytesToBase64(new Uint8Array(await new Response(payload).arrayBuffer())),
      mimeType: 'image/png',
    };
  }

  return null;
}

/**
 * The premium sprite brief is too long for FLUX.1 Schnell's 2048-character limit.
 * Only Schnell receives this compact fallback; FLUX.2 and Gemini keep full detail.
 */
export function compactSchnellImagePrompt(prompt: string): string {
  const firstLine = prompt.split('\n', 1)[0]?.trim() || '';
  const subject = firstLine.startsWith('Create one premium pixel-art inventory sprite for this exact subject:')
    ? firstLine.slice(0, 400)
    : `Create one pixel-art inventory sprite of: ${JSON.stringify(prompt.slice(0, 180))}.`;
  const rerollToken = prompt.match(/Variation token: ([^\n]+)\./)?.[1]?.slice(0, 100);
  const concise = [
    subject,
    rerollToken ? `Reroll variant ${rerollToken}: change angle, pose or silhouette; preserve subject identity.` : '',
    'Premium 32-bit RPG inventory pixel art. One recognizable subject, centered and large (75-80%) in a square canvas.',
    'Subtle 3/4 isometric perspective, a narrow dark CHROMATIC outline in the subject hue (not black/brown), colorful stepped bevels and layered 2.5D volume.',
    'Bright colorful collectible sprite: 65-75% of visible sprite in vivid subject-appropriate midtones/highlights, with only small colored occlusion shadows. No muddy browns, sepia, charcoal cast, low exposure or dull/desaturated palette.',
    'Distinct hues for each subject: emerald leaves, azure ice/water, golden flame, vibrant purple magic, clean silver-blue metal; earthy objects may retain real brown material colors but stay well-lit.',
    'Crisp 96x96 implied pixel grid, square pixel clusters, faceted materials, bright upper-left highlights and readable 4-6 step hue-shifted color ramps.',
    'Accurate literal form: recognizable creature anatomy or object shape. No unrelated crystal/orb/slime, no extra limbs or faces on inanimate things.',
    'Absolutely no text, logos, cards, scenery, cast shadow, aura, particles, duplicate subjects or blurry/soft illustration.',
    'Perfectly flat SOLID #FF00FF magenta background across entire canvas; no gradients or noise, no magenta inside the subject. Leave clear edge padding.',
    'Output only one detailed pixel-art item, instantly readable at thumbnail size.',
  ].filter(Boolean).join('\n');
  return concise.slice(0, 2048);
}

// Once Cloudflare's free neuron allowance is depleted, both FLUX models share
// that exhausted pool. Avoid hammering them on every requested sprite.
let workersImageQuotaBackoffUntil = 0;
async function generateWorkersAiImage(prompt: string): Promise<GeminiImageResult | null> {
  const ai = getWorkersAiBinding();
  if (!ai?.run || Date.now() < workersImageQuotaBackoffUntil) return null;

  const models = [
    '@cf/black-forest-labs/flux-2-klein-4b',
    '@cf/black-forest-labs/flux-1-schnell',
  ];

  let last: unknown;
  for (const model of models) {
    try {
      let response: any;
      if (model.includes('flux-2-klein-4b')) {
        const form = new FormData();
        form.append('prompt', prompt);
        form.append('width', '512');
        form.append('height', '512');
        form.append('guidance', '4.5');
        const serialized = new Response(form);
        response = await ai.run(model, {
          multipart: {
            body: serialized.body,
            contentType: serialized.headers.get('content-type'),
          },
        });
      } else {
        response = await ai.run(model, { prompt: compactSchnellImagePrompt(prompt), steps: 8 });
      }

      const normalized = await normalizeWorkersImagePayload(response);
      if (normalized?.data && normalized.data.length >= 100 && normalized.data.length <= 16_000_000) {
        console.info(`Sprite image generated with ${model}.`);
        return { ...normalized, model };
      }
      throw new Error('Workers AI returned no usable image payload.');
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : String(error);
      if (/4006.*(?:daily free allocation|neurons)|used up your daily free allocation/i.test(message)) {
        workersImageQuotaBackoffUntil = Date.now() + 5 * 60_000;
        console.warn('Cloudflare image quota exhausted; use the Gemini fallback without retrying another FLUX model.');
        break;
      }
      if (model.includes('flux-2-klein-4b') && /3030|flagged/i.test(message)) {
        // A long decorative prompt may trip the image safety filter. Retry with a
        // compact, neutral inventory-art prompt; never attempt to bypass a filter
        // on a genuinely disallowed subject.
        const subject = prompt.match(/exact subject:\s*([^\n]+)/i)?.[1]?.slice(0, 120);
        if (subject && !/violence|weapon|sexual|nude|gore/i.test(subject)) {
          try {
            const form = new FormData();
            form.append('prompt', `A simple colorful pixel-art inventory icon of ${subject}. Single centered object, plain magenta background, no text.`);
            form.append('width', '512');
            form.append('height', '512');
            const serialized = new Response(form);
            const retry = await ai.run(model, { multipart: { body: serialized.body, contentType: serialized.headers.get('content-type') } });
            const normalized = await normalizeWorkersImagePayload(retry);
            if (normalized?.data && normalized.data.length >= 100 && normalized.data.length <= 16_000_000) return { ...normalized, model };
          } catch (retryError) {
            console.warn(`Simplified FLUX image retry failed: ${String(retryError).slice(0, 180)}`);
          }
        }
      }
      console.warn(`Workers AI image model ${model} failed: ${message}. Trying fallback...`);
    }
  }

  // Crucially, do not strand every sprite when Workers AI changes response shape or a model is
  // temporarily unavailable. Returning null lets generateGeminiImage use the configured Gemini
  // image model as the secondary provider.
  console.error('Workers AI image generation failed; falling back to Gemini:', last);
  return null;
}

/**
 * Generate a real raster image rather than asking a text model to describe vector paths.
 * This is intentionally separate from structured JSON generation because image models do
 * not support structured outputs.
 */
export async function generateGeminiImage(
  prompt: string,
  injectedClient?: Pick<GoogleGenAI, 'models'>
): Promise<GeminiImageResult> {
  if (!injectedClient) {
    const workersImage = await generateWorkersAiImage(prompt);
    if (workersImage) return workersImage;
    // Prefer Runware's low-cost FLUX.2 Klein when Cloudflare free neurons run out.
    // Only uses credits if RUNWARE_API_KEY is configured; returns the existing
    // image payload shape, so all sprite caching and client logic still work.
    const runwareImage = await generateRunwareSprite(prompt);
    if (runwareImage) return runwareImage;
  }
  if (!injectedClient && !process.env.GEMINI_API_KEY) {
    throw new ApiFailure(503, 'Sprite rendering is unavailable: Cloudflare and Runware image providers failed, and Gemini is not configured.');
  }
  const ai = injectedClient ?? (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
  const models = getGeminiImageModels();
  // Leave enough of the client's 60s timeout for Runware + a final Gemini attempt.
  const deadline = Date.now() + (!injectedClient && process.env.RUNWARE_API_KEY ? 35_000 : 55_000);
  let last: unknown;

  for (let attempt = 0; attempt < models.length; attempt++) {
    const currentModel = models[attempt];
    const controller = new AbortController();
    const remainingMs = Math.min(50000, deadline - Date.now());
    if (remainingMs <= 0) throw new ApiFailure(504, 'AI image generation timed out. Please retry.');
    const timer = setTimeout(() => controller.abort(), remainingMs);

    try {
      const response: any = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '1K',
          },
          abortSignal: controller.signal,
          httpOptions: { timeout: remainingMs },
        } as any,
      });

      if (controller.signal.aborted || Date.now() >= deadline) {
        throw new ApiFailure(504, 'AI image generation timed out. Please retry.');
      }

      const parts = (response?.candidates || [])
        .flatMap((candidate: any) => candidate?.content?.parts || [])
        .filter((part: any) => !part?.thought);

      const imagePart = parts.find((part: any) =>
        typeof part?.inlineData?.data === 'string' &&
        /^image\//i.test(String(part?.inlineData?.mimeType || 'image/png'))
      );
      const data = imagePart?.inlineData?.data;
      const mimeType = String(imagePart?.inlineData?.mimeType || 'image/png');

      if (!data || data.length < 100 || data.length > 16_000_000) {
        throw new Error('Image model returned no usable image.');
      }
      console.info(`Sprite image generated with ${currentModel}.`);
      return { data, mimeType, model: currentModel };
    } catch (error: any) {
      last = error;
      const code = Number(error?.status || error?.code);
      const terminal = terminalGeminiFailure(error);
      if (terminal) {
        if (terminal.status === 429 && !injectedClient) {
          throw new ApiFailure(503, 'Sprite rendering is temporarily unavailable: Cloudflare and Runware could not produce an image, and Gemini image quota is exhausted. Your discovery is saved; retry its artwork later.');
        }
        throw terminal;
      }

      if (attempt < models.length - 1) {
        console.warn(`Image model ${currentModel} failed (${code || error?.message || 'unknown'}). Failing over to ${models[attempt + 1]}...`);
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      if (controller.signal.aborted || code === 408 || code === 504) {
        throw new ApiFailure(504, 'AI image generation timed out. Please retry.');
      }
      if (error instanceof ApiFailure) throw error;
      throw new ApiFailure(502, 'The AI image model could not generate a sprite. Please retry.');
    } finally {
      clearTimeout(timer);
    }
  }

  throw last;
}


export function getGroqModels(): string[] {
  const sanitizeGroqModel = (name?: string): string | null => {
    if (!name || typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (!/^[a-z0-9][a-z0-9._/-]+$/i.test(trimmed)) return null;
    return trimmed;
  };
  // The 20B model answers lightweight combinations faster and leaves more room for
  // the fallback. GROQ_FAST_MODEL optionally overrides that first choice.
  return Array.from(new Set([
    sanitizeGroqModel(process.env.GROQ_FAST_MODEL),
    'openai/gpt-oss-20b',
    sanitizeGroqModel(process.env.GROQ_MODEL),
    sanitizeGroqModel(process.env.GROQ_FALLBACK_MODEL),
    'openai/gpt-oss-120b',
  ].filter((model): model is string => Boolean(model)))).slice(0, 2);
}

async function callGroqStructured(
  prompt: string,
  systemInstruction: string | undefined,
  temperature: number,
  schema?: Record<string, unknown>,
  deadlineMs?: number,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  let last: unknown;
  for (let attempt = 0; attempt < getGroqModels().length; attempt++) {
    const model = getGroqModels()[attempt];
    const remaining = deadlineMs !== undefined ? deadlineMs - Date.now() : 20000;
    if (remaining <= 0) return null;

    const controller = new AbortController();
    // The old 3.2s/2.2s aborts forced nearly every request through exhausted
    // Cloudflare/Gemini fallbacks. Give Groq time while preserving the overall deadline.
    const timeoutMs = Math.min(attempt === 0 ? 10000 : 7000, Math.max(1, remaining - 4500));
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: any = {
        model,
        // GPT-OSS defaults to medium reasoning; low is much faster for short
        // crafting results and avoids spending the timeout on hidden reasoning.
        ...(model.startsWith('openai/gpt-oss-') ? { reasoning_effort: 'low' } : {}),
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          {
            role: 'user',
            content: `${prompt}\n\nRespond with exactly one complete, syntactically valid JSON object. Use double-quoted keys and strings, no trailing commas, no markdown, no explanation. Keep values concise.`,
          },
        ],
        // Keep Groq's TPM request comfortably below the 8k/min free-tier ceiling.
        // Reserve output for JSON rather than verbose reasoning or prose.
        temperature: Math.max(0.01, Math.min(0.55, temperature)),
        max_completion_tokens: schema ? 1800 : 1200,
        stream: false,
        // Groq's strict JSON-schema validator can reject otherwise valid generations
        // for QuarkPop's larger nested discovery schemas. JSON mode is much more reliable
        // here; we still parse/validate the object locally before accepting it.
        response_format: { type: 'json_object' },
      };

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        // A 429 means this model is out of budget; don't waste tokens retrying it.
        // The next configured model/provider can still serve the request.
        if (response.status === 429) {
          console.warn(`Groq model ${model} rate limited (429); trying next provider.`);
          continue;
        }
        // JSON-mode 400 errors are model-side validation failures, not user errors.
        // Fall through to another model instead of surfacing them to the client.
        if (response.status === 400 && detail.includes('json_validate_failed')) {
          // Groq JSON mode can reject otherwise recoverable model output.
          // Retry this model once without JSON-mode enforcement, then parse locally.
          console.warn(`Groq model ${model} rejected JSON generation; retrying without enforced JSON mode.`);
          const recoveryBody = { ...body, response_format: undefined, temperature: 0.2 };
          const recovery = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(recoveryBody),
            signal: controller.signal,
          });
          if (recovery.ok) {
            const recovered: any = await recovery.json();
            const recoveredText = recovered?.choices?.[0]?.message?.content;
            if (typeof recoveredText === 'string') {
              const jsonStart = recoveredText.indexOf('{');
              const jsonEnd = recoveredText.lastIndexOf('}');
              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                try {
                  const parsed = JSON.parse(recoveredText.slice(jsonStart, jsonEnd + 1));
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return JSON.stringify(parsed);
                } catch { /* Try the next model instead. */ }
              }
            }
          }
          continue;
        }
        throw new Error(`Groq ${response.status}: ${detail.slice(0, 240)}`);
      }

      const payload: any = await response.json();
      const raw = payload?.choices?.[0]?.message?.content;
      if (typeof raw !== 'string' || !raw.trim()) throw new Error('Groq returned an empty response.');

      const cleaned = raw
        .replace(/^\s*\`\`\`(?:json)?\s*/i, '')
        .replace(/\s*\`\`\`\s*$/i, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Groq returned invalid JSON.');
      }
      return JSON.stringify(parsed);
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Groq model ${model} failed: ${message}.`);
    } finally {
      clearTimeout(timer);
    }
  }

  console.error('Groq text generation failed; falling through to secondary providers:', last);
  return null;
}

const WORKERS_TEXT_MODELS = [
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
];

function workersAiText(response: any): string | undefined {
  if (typeof response?.response === 'string') return response.response.trim();
  if (response?.response && typeof response.response === 'object') return JSON.stringify(response.response);

  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const joined = content
      .map((part: any) => typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : '')
      .join('')
      .trim();
    if (joined) return joined;
  }
  return undefined;
}

async function callWorkersAiStructured(
  prompt: string,
  systemInstruction: string | undefined,
  temperature: number,
  schema?: Record<string, unknown>,
  // Absolute timestamp (Date.now() ms) bounding the whole AI phase. When set,
  // per-model timeouts shrink to fit the remaining budget and the loop bails
  // early instead of burning quota after the client has given up.
  deadlineMs?: number,
): Promise<string | null> {
  const ai = getWorkersAiBinding();
  if (!ai?.run) return null;

  let last: unknown;
  for (let attempt = 0; attempt < WORKERS_TEXT_MODELS.length; attempt++) {
    if (deadlineMs !== undefined && Date.now() >= deadlineMs) {
      console.warn('Workers AI phase reached the shared AI deadline; falling through.');
      return null;
    }
    const model = WORKERS_TEXT_MODELS[attempt];
    const messages = [
      ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
      { role: 'user', content: prompt },
    ];

    // First try the strongest structured mode. If the model rejects that response format,
    // retry once with a strict "JSON only" instruction instead of immediately spilling to Gemini.
    for (let formatAttempt = 0; formatAttempt < 2; formatAttempt++) {
      try {
        const recovery = formatAttempt === 1;
        const recoveryMessages = recovery
          ? [
              ...messages.slice(0, -1),
              {
                role: 'user',
                content: `${prompt}\n\nReturn ONLY one valid JSON object. No markdown, no prose before or after it.`,
              },
            ]
          : messages;

        const input: any = {
          messages: recoveryMessages,
          stream: false,
          temperature: recovery ? Math.min(0.55, temperature) : Math.min(1, Math.max(0, temperature)),
          max_tokens: 1400,
        };
        if (!recovery) {
          // These Workers AI text models do not reliably support JSON Schema (5025).
          // Use JSON object mode, then validate the result in the app instead.
          input.response_format = { type: 'json_object' };
        }

        const run = ai.run(model, input);
        const modelTimeoutMs = attempt === 0 ? 5500 : 4000;
        // Shrink the per-attempt timeout to whatever is left of the shared
        // deadline, so a slow Workers AI can't eat the Gemini fallback's budget.
        const remainingMs = deadlineMs !== undefined ? deadlineMs - Date.now() : modelTimeoutMs;
        if (remainingMs <= 0) {
          console.warn('Workers AI phase out of shared AI budget; falling through.');
          return null;
        }
        const timeoutMs = Math.min(modelTimeoutMs, Math.max(1, remainingMs - 6500));
        const response: any = await Promise.race([
          run,
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Workers AI text request timed out after ${timeoutMs}ms.`)), timeoutMs)),
        ]);

        const raw = workersAiText(response);
        if (!raw) throw new Error('Workers AI returned an empty response.');

        const cleaned = raw
          .replace(/^\s*```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/i, '')
          .trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        const jsonText = firstBrace >= 0 && lastBrace > firstBrace
          ? cleaned.slice(firstBrace, lastBrace + 1)
          : cleaned;

        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Workers AI returned invalid JSON.');
        }
        return JSON.stringify(parsed);
      } catch (error) {
        last = error;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Workers AI text model ${model} attempt ${formatAttempt + 1} failed: ${message}.`);
      }
    }
  }

  console.error('Workers AI text generation failed after structured and recovery attempts:', last);
  return null;
}

export async function callGeminiStructured(
  prompt: string | { parts: any[] },
  systemInstruction?: string,
  temperature = 0.4,
  injectedClient?: Pick<GoogleGenAI, 'models'>,
  drawingOptions?: { timeoutMs: number; schema: Record<string, unknown> }
): Promise<string> {
  // One end-to-end deadline for the whole AI phase (Workers AI + Gemini
  // fallback). Previously each phase had its own budget, so a degraded
  // Workers AI could burn ~48s of quota after the 30s client abort and then
  // still run the full Gemini fallback. Cap normal requests at ~25s so the
  // client never waits on a dead request; drawing calls keep their own budget.
  const overallDeadline = Date.now() + (drawingOptions ? Math.min(55000, drawingOptions.timeoutMs) : 27000);
  const discoveryRequest = isDiscoveryInstruction(systemInstruction);
  const foundryRequest = isFoundryPrompt(prompt);
  const effectiveSystemInstruction = discoveryRequest && systemInstruction
    ? enhanceDiscoveryInstruction(systemInstruction)
    : systemInstruction;

  // Provider order for text generation:
  // 1) Groq (fast primary), 2) Cloudflare Workers AI, 3) Gemini fallback.
  // Injected Gemini clients used by tests/multimodal paths bypass external text providers.
  let workersAiAttempted = false;
  if (!injectedClient && typeof prompt === 'string') {
    const providerPrompt = foundryRequest
      ? enhanceFoundryPrompt(prompt, null)
      : discoveryRequest
        ? enrichDiscoveryPrompt(prompt) as string
        : prompt;
    const providerTemperature = foundryRequest
      ? Math.max(0.65, temperature)
      : discoveryRequest
        ? Math.max(0.72, temperature)
        : temperature;
    const providerSchema = drawingOptions?.schema || (discoveryRequest ? DISCOVERY_RESPONSE_SCHEMA : undefined);

    const groqResult = await callGroqStructured(
      providerPrompt,
      effectiveSystemInstruction,
      providerTemperature,
      providerSchema,
      overallDeadline,
    );
    if (groqResult) return groqResult;

    workersAiAttempted = true;
    const workersResult = await callWorkersAiStructured(
      providerPrompt,
      effectiveSystemInstruction,
      providerTemperature,
      providerSchema,
      overallDeadline,
    );
    if (workersResult) return workersResult;

    console.warn('Groq and Workers AI unavailable; attempting the final Gemini fallback.');
  }

  if (!injectedClient && !process.env.GEMINI_API_KEY) {
    throw new ApiFailure(503, 'AI is not configured. Add GROQ_API_KEY for primary text generation or GEMINI_API_KEY for fallback/multimodal generation.');
  }
  const ai = injectedClient ?? (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
  const models = getGeminiModels();
  // Reuse the shared phase deadline instead of minting a fresh 29s budget here;
  // whatever Workers AI consumed comes out of the fallback's time, not on top of it.
  const deadline = overallDeadline;

  let foundryIdea: FoundryIdea | null = null;
  // Skip the idea pre-pass when Workers AI already attempted the request: the
  // prompt was already enhanced for Workers AI above, so this extra Gemini call
  // just burns quota re-deriving ideas on the fallback path. (Tests inject a
  // client, which bypasses Workers AI, so they keep the old behavior.)
  if (foundryRequest && typeof prompt === 'string' && models[0] && !workersAiAttempted) {
    foundryIdea = await searchFoundryIdeas(ai, models[0], prompt);
  }

  const effectivePrompt = foundryRequest && typeof prompt === 'string'
    ? enhanceFoundryPrompt(prompt, foundryIdea)
    : discoveryRequest
      ? enrichDiscoveryPrompt(prompt)
      : prompt;
  const effectiveTemperature = foundryRequest
    ? (foundryIdea ? Math.max(0.48, temperature) : Math.max(0.65, temperature))
    : discoveryRequest
      ? Math.max(0.72, temperature)
      : temperature;

  let last: unknown;
  for (let attempt = 0; attempt < models.length; attempt++) {
    const currentModel = models[attempt];
    const controller = new AbortController();
    const remainingMs = Math.min(
      drawingOptions ? 25000 : foundryRequest ? 21000 : 14000,
      deadline - Date.now()
    );
    if (remainingMs <= 0) throw new ApiFailure(504, 'AI request timed out. Please retry.');
    const timer = setTimeout(() => controller.abort(), remainingMs);
    try {
      const config: any = {
        responseMimeType: 'application/json',
        temperature: effectiveTemperature,
        systemInstruction: effectiveSystemInstruction,
        abortSignal: controller.signal,
        httpOptions: { timeout: remainingMs },
      };
      if (discoveryRequest) config.responseJsonSchema = DISCOVERY_RESPONSE_SCHEMA;
      if (drawingOptions) {
        config.responseJsonSchema = drawingOptions.schema;
        config.thinkingConfig = { thinkingLevel: 'MINIMAL' };
      }

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: effectivePrompt,
        config,
      });
      if (controller.signal.aborted || Date.now() >= deadline) throw new ApiFailure(504, 'AI request timed out. Please retry.');
      const raw = response.text?.trim();
      if (!raw) throw new Error('AI returned an empty response');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object');
      return raw;
    } catch (error: any) {
      last = error;
      const code = Number(error?.status || error?.code);
      const terminal = terminalGeminiFailure(error);
      if (terminal) {
        if (!injectedClient && typeof prompt === 'string' && Boolean(process.env.GROQ_API_KEY) && terminal.status === 429) {
          throw new ApiFailure(503, 'Combination AI is temporarily unavailable: Groq and Cloudflare could not respond, and Gemini has reached its quota. Try again later.');
        }
        throw terminal;
      }

      if (attempt < models.length - 1) {
        console.warn(`Model ${currentModel} failed (${code || error?.message || 'unknown'}). Failing over to ${models[attempt + 1]}...`);
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }

      if (controller.signal.aborted || code === 408 || code === 504) {
        throw new ApiFailure(504, 'AI request timed out. Please retry.');
      }
      if (error instanceof ApiFailure) throw error;
      throw new ApiFailure(502, 'The AI was unable to generate a valid result. Please retry.');
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}
