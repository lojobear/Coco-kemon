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
  return error instanceof ApiFailure ? { status: error.status, error: error.message } :
    { status: 502, error: 'The AI returned an invalid result. Please retry.' };
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

function isDiscoveryInstruction(systemInstruction?: string): boolean {
  return Boolean(systemInstruction?.includes('playful conceptual crafting game'));
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
  prompt: string | { parts: any[] }, systemInstruction?: string, temperature = 0.4,
  injectedClient?: Pick<GoogleGenAI, 'models'>
): Promise<string> {
  if (!injectedClient && !process.env.GEMINI_API_KEY) throw new ApiFailure(503, 'AI is not configured. Add a Gemini API key on the server.');
  const ai = injectedClient ?? (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));

  const discoveryRequest = isDiscoveryInstruction(systemInstruction);
  const effectiveSystemInstruction = discoveryRequest && systemInstruction ? enhanceDiscoveryInstruction(systemInstruction) : systemInstruction;
  const effectivePrompt = discoveryRequest ? enrichDiscoveryPrompt(prompt) : prompt;
  const effectiveTemperature = discoveryRequest ? Math.max(0.55, temperature) : temperature;
  
  const configured = sanitizeModel(process.env.GEMINI_MODEL);
  const fallback = sanitizeModel(process.env.GEMINI_FALLBACK_MODEL);
  
  // Prefer the configured model, then a distinct fallback.
  const candidates = [
    configured,
    fallback,
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ].filter((m): m is string => Boolean(m));
  
  // Two 12-second attempts plus a 200ms delay fit the browser's 30s deadline.
  const models = Array.from(new Set(candidates)).slice(0, 2);

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
        // Quota exhaustion affects all models for this key
        throw new ApiFailure(429, 'Gemini quota reached. Please wait a moment before retrying.');
      }
      if (code === 401 || code === 403) {
        throw new ApiFailure(503, 'Gemini API key is invalid or unauthorized. Please verify your key.');
      }
      
      // If there are more model candidates to try, failover to the next candidate
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
