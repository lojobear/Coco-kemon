import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { STARTER_MATERIALS, ALL_PROCESSES, INITIAL_HABITATS } from '../src/lib/starterData';
import { STARTER_ELEMENTS } from '../src/lib/infiniteCraftData';
import { validMaterial } from '../src/lib/validation';
import { requestJson } from '../src/lib/api';
import { callGeminiStructured, ApiFailure } from '../server/gemini';
import { parseSave, importCompleteSave, exportCompleteSave, SAVE_KEY, validateFoundry, saveCraftElements, getSaveError } from '../src/lib/saveData';

class MemoryStorage {
  values = new Map<string, string>();
  fail = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error('QuotaExceeded'); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const storage = new MemoryStorage();
Object.assign(globalThis, { localStorage: storage, window: new EventTarget() });
const foundry = { version: 1, materials: STARTER_MATERIALS, oddkinCollection: [], processes: ALL_PROCESSES, habitats: INITIAL_HABITATS, experiments: [] };
const crafting = [...STARTER_ELEMENTS, { id: 'coffee', name: 'Coffee', emoji: '☕', recipe: { first: 'Bean', second: 'Water' } }];
const complete = { version: 2, foundry, crafting };

test('complete backup round trip retains both collections and recipe history', () => {
  assert.ok(STARTER_MATERIALS.every(validMaterial));
  assert.ok(validateFoundry(foundry));
  const restored = importCompleteSave(JSON.stringify(complete));
  const exported = JSON.parse(exportCompleteSave(restored));
  assert.deepEqual(exported.foundry.materials, STARTER_MATERIALS);
  assert.deepEqual(exported.crafting, crafting);
  assert.deepEqual(parseSave(JSON.stringify(exported)), { foundry, crafting });
});

test('legacy backup preserves the current crafting collection', () => {
  const parsed = parseSave(JSON.stringify(foundry));
  assert.deepEqual(parsed.crafting, crafting);
  assert.deepEqual(parsed.foundry.materials, STARTER_MATERIALS);
});

test('malformed or future backups leave the committed save unchanged', () => {
  const before = storage.getItem(SAVE_KEY);
  for (const bad of ['{', JSON.stringify({ ...complete, version: 3 }), JSON.stringify({ ...complete, crafting: [{ name: 42 }] }), JSON.stringify({ ...complete, foundry: { ...foundry, materials: [{ id: 'broken' }] } })]) {
    assert.throws(() => importCompleteSave(bad));
    assert.equal(storage.getItem(SAVE_KEY), before);
  }
});

test('quota failure is visible, preserves old save, and new crafting progress remains exportable', () => {
  const before = storage.getItem(SAVE_KEY);
  storage.fail = true;
  assert.throws(() => importCompleteSave(JSON.stringify(complete)));
  const more = [...crafting, { id: 'tea', name: 'Tea', emoji: '🍵' }];
  saveCraftElements(more);
  assert.match(getSaveError()!, /could not be saved/);
  assert.equal(storage.getItem(SAVE_KEY), before);
  assert.deepEqual(JSON.parse(exportCompleteSave(foundry)).crafting, more);
  storage.fail = false;
  importCompleteSave(JSON.stringify(complete));
  assert.equal(getSaveError(), null);
});

test('HTTP errors, invalid JSON and timeout all reject instead of becoming discoveries', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Quota reached' }), { status: 429 });
    await assert.rejects(requestJson('/test'), /Quota reached/);
    globalThis.fetch = async () => new Response('not-json');
    await assert.rejects(requestJson('/test'), /invalid result/);
    globalThis.fetch = async (_url, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('AbortError'))));
    await assert.rejects(requestJson('/test', {}, 15), /timed out/);
    globalThis.fetch = async () => new Response(JSON.stringify({ result: 'Steam' }));
    assert.deepEqual(await requestJson('/test'), { result: 'Steam' });
  } finally { globalThis.fetch = original; }
});

test('Gemini quota is not retried; malformed output is rejected; transient failure retries once', async () => {
  let calls = 0;
  const client = (generateContent: any) => ({ models: { generateContent } }) as any;
  await assert.rejects(callGeminiStructured('test', undefined, 0.4, client(async () => { calls++; throw { status: 429 }; })), (e: any) => e instanceof ApiFailure && e.status === 429);
  assert.equal(calls, 1);
  await assert.rejects(callGeminiStructured('test', undefined, 0.4, client(async () => ({ text: '[1,2]' }))), /valid result/);
  calls = 0;
  const result = await callGeminiStructured('test', undefined, 0.4, client(async (args: any) => {
    assert.ok(args.config.abortSignal);
    calls++;
    if (calls === 1) throw { status: 503 };
    return { text: '{"result":"Steam","emoji":"💨"}' };
  }));
  assert.equal(calls, 2);
  assert.equal(JSON.parse(result).result, 'Steam');
});

test('API retains canonical crafting and foundry recipes without an AI key, rejects unknown pairs and malformed input', async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.GEMINI_API_KEY;
  const { app } = await import('../server');
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const pair = await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first: 'Water', second: 'Fire' }) });
    assert.equal(pair.status, 200); assert.equal((await pair.json()).result, 'Steam');
    const unknown = await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first: 'Uncatalogued A', second: 'Uncatalogued B' }) });
    assert.equal(unknown.status, 503); assert.equal((await unknown.json()).result, undefined);
    const bad = await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first: 12, second: {} }) });
    assert.equal(bad.status, 400);
    const material = (name: string) => STARTER_MATERIALS.find(m => m.canonicalName === name)!;
    const response = await fetch(`${base}/api/synthesize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputMaterialA: material('SOIL'), inputMaterialB: material('WATER'), process: ALL_PROCESSES.find(p => p.id === 'MIX') }) });
    const data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.material.displayName, 'Mud'); assert.ok(validMaterial(data.material));
  } finally { server.close(); await once(server, 'close'); }
});
