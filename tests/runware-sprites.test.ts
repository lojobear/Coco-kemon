import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRunwareSprite, RUNWARE_SPRITE_MODEL } from '../server/runware';

const PNG_BASE64 = 'A'.repeat(256);

test('Runware fallback uses low-cost FLUX.2 and server-side bearer authentication', async () => {
  let seen = false;
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    seen = true;
    assert.equal(String(url), 'https://api.runware.ai/v1');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-key');
    const tasks = JSON.parse(String(init?.body));
    assert.equal(tasks.length, 1);
    const task = tasks[0];
    assert.equal(task.taskType, 'imageInference');
    assert.equal(task.model, RUNWARE_SPRITE_MODEL);
    assert.equal(task.positivePrompt, 'bright 2.5D pixel potion');
    assert.equal(task.width, 512);
    assert.equal(task.height, 512);
    assert.equal(task.numberResults, 1);
    assert.equal(task.outputType, 'base64Data');
    assert.equal(task.outputFormat, 'PNG');
    assert.match(task.taskUUID, /^[a-f0-9-]{36}$/);
    return Response.json({ data: [{
      taskType: 'imageInference', taskUUID: task.taskUUID,
      imageBase64Data: PNG_BASE64,
    }] });
  }) as typeof fetch;

  const sprite = await generateRunwareSprite('bright 2.5D pixel potion', { apiKey: 'test-key', fetcher });
  assert.ok(seen);
  assert.deepEqual(sprite, { data: PNG_BASE64, mimeType: 'image/png', model: RUNWARE_SPRITE_MODEL });
});

test('Runware gracefully skips an unconfigured key without calling the API', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return Response.json({ data: [] }); }) as typeof fetch;
  const sprite = await generateRunwareSprite('moon rock', { apiKey: '', fetcher });
  assert.equal(sprite, null);
  assert.equal(calls, 0);
});

test('Runware failures are non-fatal and never return invalid payloads', async () => {
  const fetcher = (async () => Response.json({ errors: [{ message: 'insufficient credits' }] }, { status: 402 })) as typeof fetch;
  assert.equal(await generateRunwareSprite('moon rock', { apiKey: 'test-key', fetcher }), null);
  const invalid = (async () => Response.json({ data: [{ taskType: 'imageInference', imageBase64Data: 'not-a-png' }] })) as typeof fetch;
  assert.equal(await generateRunwareSprite('moon rock', { apiKey: 'test-key', fetcher: invalid }), null);
});
