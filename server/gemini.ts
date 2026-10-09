import { GoogleGenAI } from '@google/genai';
import { conceptDNAFor } from './discovery.js';
import { getWorkersAiBinding } from './workersAi.js';

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
      minItems: 6,
      maxItems: 8,
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
  let enhanced = systemInstruction
    .replace(
      'Consider up to three DISTINCT possible results using different connections: science, function,\nappearance, mythology or wordplay.',
      'Consider EIGHT DISTINCT possible results when possible. Start from the meanings and affordances of BOTH inputs, then explore genuinely different causal bridges. The connection label is only metadata and must not constrain the result domain.'
    )
    .replace('Return JSON with a candidates array (1–3 items)', 'Return JSON with a candidates array (6–8 items)')
    .replace(
      'result, emoji, connection (science/function/appearance/mythology/wordplay),',
      'result, emoji, connection (science/function/appearance/mythology/wordplay/chemistry/physics/biology/ecology/technology/history/geography/food/pop-culture/brand/character/comedy/language),'
    );

  enhanced += `\n\nINFINITE DISCOVERY PRINCIPLES:\n- This is an effectively unbounded semantic graph, not a finite recipe catalog. Do not choose from a hidden taxonomy of allowed answers. Any recognizable or coherent concept can become a node if the pair truly earns it.\n- Meaning first, domain second. NEVER decide “this should be science/pop culture/food” and force the ingredients into that genre. First ask what relationship between BOTH inputs naturally produces or evokes something else.\n- Generate 6–8 genuinely different candidate bridges, not cosmetic synonyms. Examples of bridge types include physical transformation, shared function, cultural association, linguistic relation, category progression, scale change, composition, tool-use, mythology, history, geography, food, technology, character/reference, visual resemblance, and emergent behavior—but this list is illustrative, not exhaustive.\n- Both inputs should matter. Silently reject candidates that could have been generated just as well from only one parent. For wordplay or cultural references, the explanation must make the two-parent bridge immediately understandable.\n- Prefer specific names people actually recognize: “Snow Globe”, “Arcade”, “Sushi”, “Batman”, “Saturn”, “Wi‑Fi”, “Treasure Map”, or a crisp original concept when appropriate. Avoid pseudo-scientific filler such as Quantum-X, Cosmic-X, Neo-X, Matrix-X, Core-X, or vague adjective+noun sludge unless the pair genuinely demands it.\n- Pop culture, brands, characters, memes, games, films, TV, anime, comics, music, places, historical figures/objects, foods, everyday items, technologies, living things, abstract ideas, and jokes are all valid outcomes when the semantic bridge is strong. Do not force recognizable references merely for novelty.\n- Reward the “ohhh, of course” feeling over raw weirdness. Surprise is good only after coherence.\n- Favor concepts with strong future-chain potential: things that have functions, properties, cultural associations, parts, opposites, habitats, materials, categories, or transformations that can combine again. Avoid dead-end flavor phrases.\n- Identical input pairs are deterministic at the game layer once discovered; your job is therefore to make the first selected concept worth keeping.\n- Treat coherence, inputFit, recognizability, chainPotential, novelty, and surprise as honest self-assessments. Do not inflate them. The server independently ranks candidates.\n- Preserve useful semantic inheritance from parent metadata when available, but descendants are allowed to cross domains naturally.\n- Return only the required JSON candidates; never reveal hidden comparison or chain-of-thought.`;

  return enhanced;
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
    'gemini-nano-banana-2.1',
    'gemini-3.1-flash-lite-image',
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

async function generateWorkersAiImage(prompt: string): Promise<GeminiImageResult | null> {
  const ai = getWorkersAiBinding();
  if (!ai?.run) return null;

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
        response = await ai.run(model, { prompt, steps: 8 });
      }

      const candidate = response?.image ?? response?.result?.image ?? response;
      const normalized = await normalizeWorkersImagePayload(candidate);
      if (normalized?.data && normalized.data.length >= 100 && normalized.data.length <= 16_000_000) {
        return { ...normalized, model };
      }
      throw new Error('Workers AI returned no usable image payload.');
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : String(error);
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
  }
  if (!injectedClient && !process.env.GEMINI_API_KEY) {
    throw new ApiFailure(503, 'AI image generation is not configured. Add a Gemini API key on the server.');
  }
  const ai = injectedClient ?? (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
  const models = getGeminiImageModels();
  const deadline = Date.now() + 55000;
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
      return { data, mimeType, model: currentModel };
    } catch (error: any) {
      last = error;
      const code = Number(error?.status || error?.code);
      const terminal = terminalGeminiFailure(error);
      if (terminal) throw terminal;

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


const WORKERS_TEXT_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct',
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
): Promise<string | null> {
  const ai = getWorkersAiBinding();
  if (!ai?.run) return null;

  let last: unknown;
  for (let attempt = 0; attempt < WORKERS_TEXT_MODELS.length; attempt++) {
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
          input.response_format = schema
            ? { type: 'json_schema', json_schema: schema }
            : { type: 'json_object' };
        }

        const run = ai.run(model, input);
        const timeoutMs = attempt === 0 ? 14000 : 10000;
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
  const discoveryRequest = isDiscoveryInstruction(systemInstruction);
  const foundryRequest = isFoundryPrompt(prompt);
  const effectiveSystemInstruction = discoveryRequest && systemInstruction
    ? enhanceDiscoveryInstruction(systemInstruction)
    : systemInstruction;

  // Prefer Cloudflare Workers AI for production text generation, but never strand the
  // player if Workers AI is saturated, times out, or returns malformed JSON. Fall through
  // to the configured Gemini models as a secondary provider.
  if (!injectedClient && typeof prompt === 'string') {
    const workersPrompt = foundryRequest
      ? enhanceFoundryPrompt(prompt, null)
      : discoveryRequest
        ? enrichDiscoveryPrompt(prompt) as string
        : prompt;
    const workersTemperature = foundryRequest
      ? Math.max(0.65, temperature)
      : discoveryRequest
        ? Math.max(0.72, temperature)
        : temperature;
    const workersSchema = drawingOptions?.schema || (discoveryRequest ? DISCOVERY_RESPONSE_SCHEMA : undefined);

    const workersResult = await callWorkersAiStructured(
      workersPrompt,
      effectiveSystemInstruction,
      workersTemperature,
      workersSchema,
    );
    if (workersResult) return workersResult;

    // Workers AI was unavailable/busy or returned unusable structured output.
    // Continue below to Gemini instead of surfacing a 503 to the player.
    console.warn('Workers AI text generation unavailable; falling back to Gemini.');
  }

  if (!injectedClient && !process.env.GEMINI_API_KEY) {
    throw new ApiFailure(503, 'AI is not configured. Add a Gemini API key on the server.');
  }
  const ai = injectedClient ?? (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
  const models = getGeminiModels();
  const deadline = Date.now() + (drawingOptions ? Math.min(55000, drawingOptions.timeoutMs) : 29000);

  let foundryIdea: FoundryIdea | null = null;
  if (foundryRequest && typeof prompt === 'string' && models[0]) {
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
      if (terminal) throw terminal;

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
