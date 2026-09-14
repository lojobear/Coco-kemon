import { GoogleGenAI } from '@google/genai';

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

let client: GoogleGenAI | undefined;
export async function callGeminiStructured(
  prompt: string | { parts: any[] }, systemInstruction?: string, temperature = 0.4,
  injectedClient?: Pick<GoogleGenAI, 'models'>
): Promise<string> {
  if (!injectedClient && !process.env.GEMINI_API_KEY) throw new ApiFailure(503, 'AI is not configured. Add a Gemini API key on the server.');
  const ai = injectedClient ?? (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
  
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
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature,
          systemInstruction,
          abortSignal: controller.signal,
          httpOptions: { timeout: 12000 },
        },
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
