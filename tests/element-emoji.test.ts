import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerEmojiRoute } from '../server/emoji';
import { emojiKey, renderEmojiDrawing } from '../src/lib/emojiGeometry';
import { generateGeminiImage } from '../server/gemini';

const drawing = { paths: [{ d: 'M12 12L116 12L64 116Z', fill: '#ff9900' }, { d: 'M30 20L90 20L64 70Z', fill: '#ffee99' }] };
const fakeImage = { data: 'A'.repeat(256), mimeType: 'image/png', model: 'test-image-model' };

test('emoji identity normalizes whitespace, case and Unicode', () => {
  assert.equal(emojiKey('  Moon   Rock '), emojiKey('moon rock'));
  assert.equal(emojiKey('Ｆｉｒｅ'), 'fire');
  assert.notEqual(emojiKey('Moon'), emojiKey('Moon Rock'));
});

test('legacy drawing grammar stays safe for existing procedural/vector callers', () => {
  const rendered = renderEmojiDrawing({
    paths: [
      { d: 'M16 70L16 34L40 14L64 14L90 14L112 36L112 70L64 116L16 108Z', fill: '#ff9900' },
      { d: 'M30 42L52 22L76 30L100 54L58 48L30 66Z', fill: '#fff2bd', opacity: 0.72 },
    ],
  });
  assert.match(rendered, /viewBox="0 0 128 128"/);
  assert.match(rendered, /shape-rendering="crispEdges"/);
  assert.match(rendered, /opacity="0.72"/);

  for (const bad of [
    { paths: [] }, { paths: Array(81).fill(drawing.paths[0]) },
    { paths: [drawing.paths[0], { d: 'M0 0" onload="alert(1)Z', fill: '#ffffff' }] },
    { paths: [drawing.paths[0], { d: 'M0 0L5 5Z', fill: 'url(https://evil.test)' }] },
    { paths: [drawing.paths[0], { d: 'M0 0L140 5Z', fill: '#ffffff' }] },
    { paths: [drawing.paths[0], { d: 'M0 0L5 5Z', fill: '#ffffff', opacity: 2 }] },
  ]) assert.throws(() => renderEmojiDrawing(bad));
});

test('native image helper extracts non-thinking image output', async () => {
  const fakeClient: any = {
    models: {
      generateContent: async () => ({
        candidates: [{
          content: {
            parts: [
              { thought: true, inlineData: { data: 'THOUGHT', mimeType: 'image/png' } },
              { inlineData: { data: fakeImage.data, mimeType: fakeImage.mimeType } },
            ],
          },
        }],
      }),
    },
  };
  const result = await generateGeminiImage('pixel sword', fakeClient);
  assert.equal(result.data, fakeImage.data);
  assert.equal(result.mimeType, 'image/png');
  assert.ok(result.model.includes('gemini-'));
});

test('endpoint generates once for simultaneous and repeated canonical names', async () => {
  const app = express();
  app.use(express.json());
  let calls = 0;
  registerEmojiRoute(app, async () => {
    calls++;
    await new Promise(r => setTimeout(r, 20));
    return fakeImage;
  });
  const server = app.listen(0);
  await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const post = (name: unknown, extra: Record<string, unknown> = {}) => fetch(base + '/api/element-emoji', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...extra }),
  });

  try {
    const replies = await Promise.all([post('Moon Rock'), post(' moon   rock ')]);
    assert.ok(replies.every(r => r.ok));
    const firstReply = await replies[0].json() as any;
    const secondReply = await replies[1].json() as any;
    assert.deepEqual(firstReply, secondReply);
    assert.equal(firstReply.engineVersion, 'v8-cloudflare-pixel');
    assert.equal(firstReply.provenance, 'gemini-native-image-pixel-art');
    assert.equal(firstReply.mimeType, 'image/png');
    assert.equal(firstReply.imageBase64, fakeImage.data);
    assert.equal((await post('MOON ROCK')).status, 200);
    assert.equal(calls, 1);

    const refreshed = await post('Moon Rock', { regenerate: true, variation: 'reroll-a' });
    assert.equal(refreshed.status, 200);
    assert.equal(calls, 2);
    assert.equal((await post('')).status, 400);
    assert.equal((await post({ bad: true })).status, 400);
    assert.equal(calls, 2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(r => server.close(() => r()));
  }
});

test('client deduplicates, persists normalized high-resolution art, and supports rerolls', async () => {
  const records = new Map<string, string>();
  const oldIndexedDB = globalThis.indexedDB;
  const oldFetch = globalThis.fetch;
  const oldImage = globalThis.Image;
  const oldDocument = globalThis.document;

  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      src = '';
      async decode() {}
    },
  });

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          clearRect() {},
          imageSmoothingEnabled: true,
        }),
        toDataURL: () => 'data:image/png;base64,dGVzdA==',
      }),
    },
  });

  let calls = 0;
  const fakeDb = {
    transaction(_name: string, _mode?: string) {
      const tx: any = {
        objectStore: () => ({
          get(key: string) {
            const req: any = {};
            queueMicrotask(() => {
              req.result = records.get(key);
              req.onsuccess();
            });
            return req;
          },
          put(value: string, key: string) {
            records.set(key, value);
            queueMicrotask(() => tx.oncomplete());
          },
        }),
      };
      return tx;
    },
  };

  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open() {
        const req: any = {};
        queueMicrotask(() => {
          req.result = fakeDb;
          req.onsuccess();
        });
        return req;
      },
    },
  });

  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({
      imageBase64: fakeImage.data,
      mimeType: fakeImage.mimeType,
      engineVersion: 'v8-cloudflare-pixel',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const first = await import('../src/lib/elementEmoji.ts' + '?native-first');
    const [a, b] = await Promise.all([
      first.getElementEmoji('Moon Rock'),
      first.getElementEmoji(' MOON  ROCK '),
    ]);
    assert.equal(a, b);
    assert.equal(calls, 1);
    assert.equal(records.size, 1);

    const reloaded = await import('../src/lib/elementEmoji.ts' + '?native-reloaded');
    assert.equal(await reloaded.getElementEmoji('moon rock'), a);
    assert.equal(calls, 1);

    await reloaded.upgradeElementEmoji('moon rock', 'upgrade-a');
    assert.equal(calls, 2);
    await reloaded.upgradeElementEmoji('moon rock', 'reroll-b');
    assert.equal(calls, 3);
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: oldIndexedDB });
    globalThis.fetch = oldFetch;
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: oldImage });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: oldDocument });
  }
});
