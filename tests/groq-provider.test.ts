import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiFailure, callGeminiStructured } from '../server/gemini';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Matches isFoundryPrompt() so the request exercises the foundry path.
const prompt = 'You are the synthesis engine for ODDKIN FOUNDRY\nINPUT A: Soil\nAPPLIED PROCESS: Grow';

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function groqOk(content = '{"status":"no_reaction","explanation":"Groq handled it."}'): Response {
  return jsonResponse({ choices: [{ message: { content } }] });
}

function geminiOk(text = '{"status":"no_reaction","explanation":"Gemini handled it."}'): Response {
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] });
}

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    prev[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key] as string;
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key] as string;
    }
  }
}

async function withFetch(
  stub: (url: string, init: any) => Promise<Response>,
  fn: () => Promise<void>,
) {
  const prev = globalThis.fetch;
  globalThis.fetch = stub as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = prev;
  }
}

test('Groq answers first when a key is configured, Gemini is never hit', async () => {
  const calls: { url: string; init: any }[] = [];
  await withEnv({ GROQ_API_KEY: 'test-groq-key', GEMINI_API_KEY: 'test-gemini-key' }, () =>
    withFetch(async (url, init) => {
      calls.push({ url, init });
      assert.ok(url.startsWith(GROQ_URL), `unexpected fetch to ${url}`);
      return groqOk();
    }, async () => {
      const result = await callGeminiStructured(prompt);
      assert.equal(JSON.parse(result).explanation, 'Groq handled it.');
    }),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers['Authorization'], 'Bearer test-groq-key');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, 'openai/gpt-oss-120b');
  assert.equal(body.response_format?.type, 'json_object');
});

test('Groq failure falls through instead of stranding the player', async () => {
  let groqCalls = 0;
  await withEnv({ GROQ_API_KEY: 'test-groq-key', GEMINI_API_KEY: undefined }, () =>
    withFetch(async (url) => {
      assert.ok(url.startsWith(GROQ_URL), `unexpected fetch to ${url}`);
      groqCalls++;
      return jsonResponse({ error: 'busy' }, 500);
    }, async () => {
      // No Gemini key configured, so after Groq + Workers AI fail we get the
      // "not configured" 503 rather than a hang or a raw 500.
      await assert.rejects(
        callGeminiStructured(prompt),
        (error: unknown) => error instanceof ApiFailure && error.status === 503,
      );
    }),
  );
  assert.equal(groqCalls, 1);
});

test('Groq is never attempted without a key', async () => {
  let fetchCalls = 0;
  await withEnv({ GROQ_API_KEY: undefined, GEMINI_API_KEY: undefined }, () =>
    withFetch(async () => {
      fetchCalls++;
      throw new Error('fetch should not have been called');
    }, async () => {
      await assert.rejects(
        callGeminiStructured(prompt),
        (error: unknown) => error instanceof ApiFailure && error.status === 503,
      );
    }),
  );
  assert.equal(fetchCalls, 0);
});

test('a Groq attempt skips the Gemini idea pre-pass on the fallback path', async () => {
  let geminiCalls = 0;
  await withEnv({ GROQ_API_KEY: 'test-groq-key', GEMINI_API_KEY: 'test-gemini-key' }, () =>
    withFetch(async (url) => {
      if (url.startsWith(GROQ_URL)) return jsonResponse({ error: 'busy' }, 500);
      assert.ok(
        url.includes('generativelanguage.googleapis.com'),
        `unexpected fetch to ${url}`,
      );
      geminiCalls++;
      return geminiOk();
    }, async () => {
      const result = await callGeminiStructured(prompt);
      assert.equal(JSON.parse(result).explanation, 'Gemini handled it.');
    }),
  );
  // Exactly one Gemini call: the first model attempt. The searchFoundryIdeas
  // pre-pass must not fire after Groq already attempted the request.
  assert.equal(geminiCalls, 1);
});

test('malformed Groq JSON falls through to the next provider', async () => {
  let groqCalls = 0;
  await withEnv({ GROQ_API_KEY: 'test-groq-key', GEMINI_API_KEY: undefined }, () =>
    withFetch(async (url) => {
      assert.ok(url.startsWith(GROQ_URL), `unexpected fetch to ${url}`);
      groqCalls++;
      return groqOk('this is not json at all');
    }, async () => {
      await assert.rejects(
        callGeminiStructured(prompt),
        (error: unknown) => error instanceof ApiFailure && error.status === 503,
      );
    }),
  );
  assert.equal(groqCalls, 1);
});
