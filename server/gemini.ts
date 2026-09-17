import { GoogleGenAI } from '@google/genai';
import { conceptDNAFor } from './discovery.js';

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
      minItems: 4,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'Concise discovery name, usually one to three words.' },
          emoji: { type: 'string', description: 'One expressive emoji for the discovery.' },
          connection: { type: 'string', enum: DISCOVERY_CONNECTIONS },
          explanation: { type: 'string', description: 'One concise player-facing sentence explaining how both inputs contribute.' },
          coherence: { type: 'integer', minimum: 1, maximum: 5 },
          surprise: { type: 'integer', minimum: 1, maximum: 5 },
        },
        required: ['result', 'emoji', 'connection', 'explanation', 'coherence', 'surprise'],
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
  const timer = setTimeout(() => controller.abort(), 5000);

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
        httpOptions: { timeout: 5000 },
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
  } catch {
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
      'Consider SIX DISTINCT possible results using different connections. Explore science, chemistry, physics, biology, ecology, function, technology, appearance, mythology, language, wordplay, history, geography, food, pop culture, brands, characters, or comedy when relevant.'
    )
    .replace('Return JSON with a candidates array (1–3 items)', 'Return JSON with a candidates array (4–6 items)')
    .replace(
      'result, emoji, connection (science/function/appearance/mythology/wordplay),',
      'result, emoji, connection (science/function/appearance/mythology/wordplay/chemistry/physics/biology/ecology/technology/history/geography/food/pop-culture/brand/character/comedy/language),'
    );

  enhanced += `\nGeneration strategy:\n- Produce six genuinely different candidates when possible; do not make cosmetic variants of the same idea.\n- Use a different connection route for each strong candidate whenever the ingredients support it.\n- Prefer recognizable nouns, named concepts, real objects, species, places, foods, technologies, characters, brands, myths, or exceptionally coherent original creatures.\n- Favor results that can combine meaningfully with many future concepts; avoid dead-end generic mashups.\n- The server independently ranks candidates, so coherence and surprise scores are advisory rather than decisive.\n- If semantic parent metadata is supplied in the user prompt, use it as factual game context and preserve useful inherited traits.`;

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
    if (!known.some((entry: { dna: unknown }) => entry.dna)) return prompt;
    return `${prompt}\nKnown semantic parent metadata from earlier discoveries: ${JSON.stringify(known)}\nUse this metadata to keep deeper crafting chains semantically consistent.`;
  } catch {
    return prompt;
  }
}

let client: GoogleGenAI | undefined;

export async function callGeminiStructured(
  prompt: string | { parts: any[] },
  systemInstruction?: string,
  temperature = 0.4,
  injectedClient?: Pick<GoogleGenAI, 'models'>
): Promise<string> {
  if (!injectedClient && !process.env.GEMINI_API_KEY) {
    throw new ApiFailure(503, 'AI is not configured. Add a Gemini API key on the server.');
  }
  const ai = injectedClient ?? (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));

  const discoveryRequest = isDiscoveryInstruction(systemInstruction);
  const foundryRequest = isFoundryPrompt(prompt);
  const effectiveSystemInstruction = discoveryRequest && systemInstruction
    ? enhanceDiscoveryInstruction(systemInstruction)
    : systemInstruction;

  const configured = sanitizeModel(process.env.GEMINI_MODEL);
  const fallback = sanitizeModel(process.env.GEMINI_FALLBACK_MODEL);
  const candidates = [
    configured,
    fallback,
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ].filter((m): m is string => Boolean(m));
  const models = Array.from(new Set(candidates)).slice(0, 2);

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
      ? Math.max(0.55, temperature)
      : temperature;

  let last: unknown;
  for (let attempt = 0; attempt < models.length; attempt++) {
    const currentModel = models[attempt];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const config: any = {
        responseMimeType: 'application/json',
        temperature: effectiveTemperature,
        systemInstruction: effectiveSystemInstruction,
        abortSignal: controller.signal,
        httpOptions: { timeout: 12000 },
      };
      if (discoveryRequest) config.responseJsonSchema = DISCOVERY_RESPONSE_SCHEMA;

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: effectivePrompt,
        config,
      });
      const raw = response.text?.trim();
      if (!raw) throw new Error('AI returned an empty response');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object');
      return raw;
    } catch (error: any) {
      last = error;
      const code = Number(error?.status || error?.code);
      if (code === 429) {
        throw new ApiFailure(429, 'Gemini quota reached. Please wait a moment before retrying.');
      }
      if (code === 401 || code === 403) {
        throw new ApiFailure(503, 'Gemini API key is invalid or unauthorized. Please verify your key.');
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
