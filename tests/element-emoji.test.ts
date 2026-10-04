import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerEmojiRoute } from '../server/emoji';
import { emojiKey, renderEmojiDrawing } from '../src/lib/emojiGeometry';
const drawing = { paths: [{ d: 'M12 12L116 12L64 116Z', fill: '#ff9900' }, { d: 'M30 20L90 20L64 70Z', fill: '#ffee99' }] };

test('emoji identity normalizes whitespace, case and Unicode', () => {
  assert.equal(emojiKey('  Moon   Rock '), emojiKey('moon rock'));
  assert.equal(emojiKey('Ｆｉｒｅ'), 'fire');
  assert.notEqual(emojiKey('Moon'), emojiKey('Moon Rock'));
});
test('AI drawing grammar rejects injected markup, URLs and oversized output', () => {
  const rendered = renderEmojiDrawing(drawing);
  assert.match(rendered, /viewBox="0 0 128 128"/);
  assert.match(rendered, /shape-rendering="crispEdges"/);
  const snapped = renderEmojiDrawing({ paths: [
    { d: 'M13 13L115 13L63 115Z', fill: '#ff9900' },
    { d: 'M31 21L91 21L63 69Z', fill: '#ffee99' },
  ] });
  assert.match(snapped, /M14 14L116 14L64 116Z/);
  for (const bad of [
    { paths: [] }, { paths: Array(81).fill(drawing.paths[0]) },
    { paths: [drawing.paths[0], { d: 'M0 0" onload="alert(1)', fill: '#ffffff' }] },
    { paths: [drawing.paths[0], { d: 'M0 0L5 5Z', fill: 'url(https://evil.test)' }] },
  ]) assert.throws(() => renderEmojiDrawing(bad));
});
test('endpoint generates once for simultaneous and repeated canonical names', async () => {
  const app = express(); app.use(express.json());
  let calls = 0;
  registerEmojiRoute(app, async () => { calls++; await new Promise(r => setTimeout(r, 20)); return JSON.stringify(drawing); });
  const server = app.listen(0);
  await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const post = (name: unknown) => fetch(base + '/api/element-emoji', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  try {
    const replies = await Promise.all([post('Moon Rock'), post(' moon   rock ')]);
    assert.ok(replies.every(r => r.ok));
    assert.deepEqual(await replies[0].json(), await replies[1].json());
    assert.equal((await post('MOON ROCK')).status, 200);
    assert.equal(calls, 1);
    const refreshed = await fetch(base + '/api/element-emoji', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Moon Rock', regenerate: true }),
    });
    assert.equal(refreshed.status, 200);
    assert.equal(calls, 2);
    assert.equal((await post('')).status, 400);
    assert.equal((await post({ bad: true })).status, 400);
    assert.equal(calls, 2);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});

test('client deduplicates in flight and reads persistent art after a module reload', async () => {
  const records = new Map<string, string>();
  const oldIndexedDB = globalThis.indexedDB;
  const oldFetch = globalThis.fetch;
  const oldImage = globalThis.Image;
  const oldDocument = globalThis.document;
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class { src = ''; async decode() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ({ drawImage() {}, clearRect() {}, imageSmoothingEnabled: false }), toDataURL: () => 'data:image/png;base64,dGVzdA==' }) } });
  let calls = 0;
  const fakeDb = { transaction(_name: string, mode?: string) {
    const tx: any = { objectStore: () => ({
      get(key: string) { const req: any = {}; queueMicrotask(() => { req.result = records.get(key); req.onsuccess(); }); return req; },
      put(value: string, key: string) { records.set(key, value); queueMicrotask(() => tx.oncomplete()); },
    }) }; return tx;
  } };
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open() { const req: any = {}; queueMicrotask(() => { req.result = fakeDb; req.onsuccess(); }); return req; } } });
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ svg: renderEmojiDrawing(drawing) }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try {
    const first = await import('../src/lib/elementEmoji.ts' + '?first');
    const [a, b] = await Promise.all([first.getElementEmoji('Moon Rock'), first.getElementEmoji(' MOON  ROCK ')]);
    assert.equal(a, b); assert.equal(calls, 1); assert.equal(records.size, 1);
    const reloaded = await import('../src/lib/elementEmoji.ts' + '?reloaded');
    assert.equal(await reloaded.getElementEmoji('moon rock'), a);
    assert.equal(calls, 1);
    await reloaded.upgradeElementEmoji('moon rock');
    assert.equal(calls, 2);
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: oldIndexedDB }); globalThis.fetch = oldFetch;
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: oldImage });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: oldDocument });
  }
});
