import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpriteAssets } from '../src/lib/spriteAssets';
import { isSpriteReference, spritePath } from '../src/lib/spriteReference';
import { applySpriteChanges, syncProfileSprites } from '../src/lib/profileSprites';
import { validateCraft } from '../src/lib/saveData';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const png = 'data:image/png;base64,iVBORw0KGgo=';
function fixture() {
  let userId: string | undefined = alice;
  let failUpload = false;
  let failMetadata = false;
  let uploads = 0;
  let downloadAttempts = 0;
  let failDownload = false;
  let onUpload = () => {};
  let onDownload = () => {};
  const rows = new Map<string, any>();
  const files = new Map<string, Blob>();
  const client: any = {
    auth: { getSession: async () => ({ data: { session: userId ? { user: { id: userId } } : null }, error: null }) },
    storage: { from: () => ({
      upload: async (path: string, blob: Blob) => {
        uploads++; onUpload();
        if (failUpload) return { error: { message: 'Offline' } };
        if (files.has(path)) return { error: { statusCode: '409', message: 'Duplicate' } };
        files.set(path, blob); return { error: null };
      },
      download: async (path: string) => {
        downloadAttempts++; onDownload();
        return { data: failDownload ? null : files.get(path), error: failDownload ? { message: 'offline' } : null };
      },
    }) },
    from: () => ({
      upsert: async (row: any, options: any) => {
        if (failMetadata) return { error: { message: 'Database unavailable' } };
        const key = `${row.user_id}:${row.sprite_key}`;
        if (!options.ignoreDuplicates || !rows.has(key)) rows.set(key, row);
        return { error: null };
      },
      select: () => {
        const filters: Record<string, string> = {};
        let rangeStart = 0, rangeEnd = Infinity;
        const execute = () => ({ data: [...rows.values()].filter(row => Object.entries(filters).every(([key, value]) => row[key] === value)).slice(rangeStart, rangeEnd + 1), error: null });
        const query: any = {
          eq: (key: string, value: string) => { filters[key] = value; return query; },
          order: () => query,
          limit: (n: number) => { rangeEnd = n - 1; return query; },
          range: (start: number, end: number) => { rangeStart = start; rangeEnd = end; return query; },
          maybeSingle: async () => { const result = execute(); return { ...result, data: result.data[0] || null }; },
          then: (resolve: any) => Promise.resolve(execute()).then(resolve),
        };
        return query;
      },
    }),
  };
  return { assets: createSpriteAssets(client), rows, files, setUser: (id?: string) => userId = id,
    failUpload: () => failUpload = true, failMetadata: () => failMetadata = true,
    failDownload: (value: boolean) => failDownload = value, onUpload: (fn: () => void) => onUpload = fn,
    onDownload: (fn: () => void) => onDownload = fn, counts: () => ({ uploads, downloadAttempts }) };
}

test('private PNGs round-trip through compact immutable references, including large sprites', async () => {
  const f = fixture();
  const big = `data:image/png;base64,${btoa('x'.repeat(150000))}`;
  const ref = await f.assets.put(alice, 'craft:water', 'Water', big);
  assert.ok(isSpriteReference(ref));
  assert.ok(validateCraft([{ id: 'water', name: 'Water', emoji: '💧', customSpriteUrl: ref }]));
  assert.equal(await f.assets.find(alice, 'craft:water'), ref);
  assert.equal(await f.assets.resolve(ref), big);
  assert.equal(await f.assets.resolve(ref), big);
  assert.equal(f.counts().downloadAttempts, 1);
  assert.equal(await f.assets.put(alice, 'material:water', 'Water', big), ref);
  assert.equal(f.files.size, 1);
  const reroll = await f.assets.put(alice, 'craft:water', 'Water', png);
  assert.notEqual(reroll, ref);
  assert.equal(f.files.size, 2, 'a replacement must not invalidate old save references');
});

test('auto migration cannot overwrite a newer sprite from another device', async () => {
  const f = fixture();
  const original = await f.assets.put(alice, 'craft:water', 'Water', png);
  const kept = await f.assets.put(alice, 'craft:water', 'Water', 'data:image/png;base64,YWJj', false);
  assert.equal(kept, original);
});

test('upload and metadata failures never publish a missing file or lose a previous entry', async () => {
  const failed = fixture(); failed.failUpload();
  await assert.rejects(failed.assets.put(alice, 'craft:a', 'A', png), /upload failed/);
  assert.equal(failed.rows.size, 0);
  const f = fixture();
  const original = await f.assets.put(alice, 'craft:a', 'A', png);
  f.failMetadata();
  await assert.rejects(f.assets.put(alice, 'craft:a', 'A', 'data:image/png;base64,YWJj'), /entry could not be saved/);
  assert.equal(await f.assets.find(alice, 'craft:a'), original);
});

test('account changes reject reads, cached downloads, and publication after upload', async () => {
  const f = fixture();
  const ref = await f.assets.put(alice, 'craft:a', 'A', png);
  await f.assets.resolve(ref);
  f.setUser(bob);
  await assert.rejects(f.assets.resolve(ref), /different profile/);
  await assert.rejects(f.assets.find(alice, 'craft:a'), /profile changed/);
  f.setUser();
  await assert.rejects(f.assets.resolve(ref), /Sign in/);
  const switched = fixture();
  switched.onUpload(() => switched.setUser(bob));
  await assert.rejects(switched.assets.put(alice, 'craft:a', 'A', png), /profile changed/);
  assert.equal(switched.rows.size, 0);
  assert.throws(() => spritePath(`sprite://${alice}/auto/../../secret.png`, alice), /different profile/);
});

test('failed downloads retry, and switching accounts during download never returns the image', async () => {
  const f = fixture();
  const ref = await f.assets.put(alice, 'craft:a', 'A', png);
  f.failDownload(true);
  await assert.rejects(f.assets.resolve(ref), /download/);
  f.failDownload(false);
  assert.equal(await f.assets.resolve(ref), png);
  f.assets.clear();
  f.onDownload(() => f.setUser(bob));
  await assert.rejects(f.assets.resolve(ref), /profile changed/);
});

test('large libraries paginate beyond 1000 assets', async () => {
  const f = fixture();
  for (let i = 0; i < 1003; i++) f.rows.set(String(i), { user_id: alice, sprite_key: `craft:${i}` });
  assert.equal((await f.assets.list(alice)).length, 1003);
});

test('applying completed uploads does not overwrite a newer local edit', () => {
  const ref = `sprite://${alice}/auto/${'a'.repeat(64)}.png`;
  const payload = { crafting: [{ id: 'water', customSpriteUrl: 'new-edit' }], foundry: { materials: [{ id: 'mat', customSpriteUrl: 'old' }], oddkinCollection: [] } };
  applySpriteChanges(payload, [{ type: 'craft', id: 'water', previous: 'old', reference: ref }, { type: 'material', id: 'mat', previous: 'old', reference: ref }]);
  assert.equal(payload.crafting[0].customSpriteUrl, 'new-edit');
  assert.equal(payload.foundry.materials[0].customSpriteUrl, ref);
});

test('another browser finds the same normalized artwork before using image generation', async () => {
  const f = fixture();
  const ref = await f.assets.put(alice, 'craft:water', 'Water', png);
  assert.equal(await f.assets.findByName(alice, ' WATER '), ref);
});

test('automatic sync backs up crafting and nested Foundry artwork and restores references on another browser', async () => {
  const f = fixture();
  const payload = { crafting: [{ id: 'water', name: 'Water' }], foundry: {
    materials: [{ id: 'steel', displayName: 'Steel', customSpriteUrl: png }],
    oddkinCollection: [{ speciesId: 'blob', speciesName: 'Blob', customSpriteUrl: png }],
  } };
  const result = await syncProfileSprites(alice, JSON.stringify(payload), 'auto', f.assets, async name => name === 'Water' ? png : undefined);
  assert.equal(result.count, 3);
  assert.deepEqual(result.changes.map(change => change.type), ['craft', 'material', 'oddkin']);
  const otherBrowser = { crafting: [{ id: 'water', name: 'Water' }], foundry: {
    materials: [{ id: 'steel', displayName: 'Steel' }], oddkinCollection: [{ speciesId: 'blob', speciesName: 'Blob' }],
  } };
  const restored = await syncProfileSprites(alice, JSON.stringify(otherBrowser), 'auto', f.assets, async () => undefined);
  assert.equal(restored.count, 3);
  assert.equal(restored.changes.length, 3);
  const compact = applySpriteChanges(otherBrowser, restored.changes);
  assert.ok(isSpriteReference(compact.crafting[0].customSpriteUrl));
  assert.ok(isSpriteReference(compact.foundry.materials[0].customSpriteUrl));
  assert.ok(isSpriteReference(compact.foundry.oddkinCollection[0].customSpriteUrl));
  assert.equal(f.counts().uploads, 3, 'restoration does not upload or generate artwork');
});

test('automatic sync preserves a conflicting local image; explicit restore/save resolves it', async () => {
  const f = fixture();
  const remote = await f.assets.put(alice, 'craft:water', 'Water', png);
  const localImage = 'data:image/png;base64,YWJj';
  const payload = { crafting: [{ id: 'water', name: 'Water', customSpriteUrl: localImage }] };
  assert.equal((await syncProfileSprites(alice, JSON.stringify(payload), 'auto', f.assets)).changes.length, 0);
  assert.equal((await syncProfileSprites(alice, JSON.stringify(payload), 'restore', f.assets)).changes[0].reference, remote);
  const saved = await syncProfileSprites(alice, JSON.stringify(payload), 'save', f.assets);
  assert.notEqual(saved.changes[0].reference, remote);
  assert.equal(await f.assets.resolve(saved.changes[0].reference), localImage);
});

test('automatic sync updates an older compact reference after artwork changes on another device', async () => {
  const f = fixture();
  const old = await f.assets.put(alice, 'craft:water', 'Water', png);
  const latest = await f.assets.put(alice, 'craft:water', 'Water', 'data:image/png;base64,YWJj');
  const payload = { crafting: [{ id: 'water', name: 'Water', customSpriteUrl: old }] };
  const result = await syncProfileSprites(alice, JSON.stringify(payload), 'auto', f.assets);
  assert.equal(result.changes[0].reference, latest);
});
