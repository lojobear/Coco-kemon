/**
 * Low-cost Runware image fallback for Boop sprites.
 * Key lives in server-side RUNWARE_API_KEY (Cloudflare secret), never in the client.
 * API: https://runware.ai/docs/models-api/authentication
 * Model: https://runware.ai/docs/models/bfl-flux-2-klein-4b
 */
import type { GeminiImageResult } from './gemini.js';

export const RUNWARE_SPRITE_MODEL = 'runware:400@4';

type RunwareResponse = {
  data?: Array<{ taskType?: string; taskUUID?: string; imageBase64Data?: string; imageDataURI?: string }>;
  errors?: Array<{ message?: string }>;
  error?: { message?: string } | string;
};

export async function generateRunwareSprite(
  prompt: string,
  options: { apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<GeminiImageResult | null> {
  const apiKey = (options.apiKey ?? process.env.RUNWARE_API_KEY ?? '').trim();
  if (!apiKey) return null;

  const taskUUID = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28_000);
  try {
    const response = await (options.fetcher || fetch)('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify([{
        taskType: 'imageInference',
        taskUUID,
        model: RUNWARE_SPRITE_MODEL,
        positivePrompt: prompt,
        width: 512,
        height: 512,
        numberResults: 1,
        outputType: 'base64Data',
        outputFormat: 'PNG',
      }]),
    });

    const payload = await response.json().catch(() => null) as RunwareResponse | null;
    if (!response.ok || !payload?.data?.length) {
      // Never log response bodies or credentials, even on provider errors.
      console.warn(`Runware sprite fallback unavailable (HTTP ${response.status}).`);
      return null;
    }

    const result = payload.data.find(item => item.taskUUID === taskUUID && item.taskType === 'imageInference');
    if (!result) {
      console.warn('Runware returned no matching sprite task.');
      return null;
    }

    const raw = result.imageBase64Data ||
      result.imageDataURI?.match(/^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/i)?.[1];
    const data = raw?.replace(/\s+/g, '');
    if (!data || data.length < 100 || data.length > 16_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      console.warn('Runware returned no valid PNG sprite payload.');
      return null;
    }
    console.info('Sprite image generated using Runware FLUX.2 Klein.');
    return { data, mimeType: 'image/png', model: RUNWARE_SPRITE_MODEL };
  } catch (error) {
    console.warn('Runware sprite fallback failed:', error instanceof Error ? error.name : 'request error');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
