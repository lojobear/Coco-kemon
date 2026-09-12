import { GoogleGenAI } from '@google/genai';

export class ApiFailure extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function publicFailure(error: unknown): { status: number; error: string } {
  return error instanceof ApiFailure ? { status: error.status, error: error.message } :
    { status: 502, error: 'The AI returned an invalid result. Please retry.' };
}
let client: GoogleGenAI | undefined;
export async function callGeminiStructured(
  prompt: string | { parts: any[] }, systemInstruction?: string, temperature = 0.4,
  injectedClient?: Pick<GoogleGenAI, 'models'>
): Promise<string> {
  if (!injectedClient && !process.env.GEMINI_API_KEY) throw new ApiFailure(503, 'AI is not configured. Add a Gemini API key on the server.');
  const ai = injectedClient ?? (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
  const models = [process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'];
  if (process.env.GEMINI_FALLBACK_MODEL && !models.includes(process.env.GEMINI_FALLBACK_MODEL)) models.push(process.env.GEMINI_FALLBACK_MODEL);
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await ai.models.generateContent({
        model: models[Math.min(attempt, models.length - 1)], contents: prompt,
        config: { responseMimeType: 'application/json', temperature, systemInstruction,
          abortSignal: controller.signal, httpOptions: { timeout: 12000 } },
      });
      const raw = response.text?.trim();
      if (!raw) throw new ApiFailure(502, 'AI returned an empty result. Please retry.');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object');
      return raw;
    } catch (error: any) {
      last = error;
      const code = Number(error?.status || error?.code);
      if (code === 429) throw new ApiFailure(429, 'Gemini quota or rate limit reached. Wait before retrying.');
      if (code === 401 || code === 403) throw new ApiFailure(503, 'Gemini access was rejected. Check the server API key and permissions.');
      if (code === 404 && models.length < 2) throw new ApiFailure(503, 'The configured Gemini model is unavailable. Check GEMINI_MODEL.');
      const transient = controller.signal.aborted || [408, 500, 502, 503, 504].includes(code);
      if (attempt === 0 && (transient || (code === 404 && models.length > 1))) {
        await new Promise(resolve => setTimeout(resolve, 400));
        continue;
      }
      if (controller.signal.aborted || code === 408 || code === 504) throw new ApiFailure(504, 'AI took too long to respond. Please retry.');
      if (error instanceof ApiFailure) throw error;
      throw new ApiFailure(502, 'AI could not produce a valid result. Please retry.');
    } finally { clearTimeout(timer); }
  }
  throw last;
}
