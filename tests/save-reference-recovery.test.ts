import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  },
  window: new EventTarget(),
});
const load = (id: string) => import(pathToFileURL(path.resolve('src/lib/saveData.ts')).href + '?' + id) as Promise<typeof import('../src/lib/saveData')>;

test('saved sprite references survive load and subsequent save', async () => {
  store.clear();
  const ref = 'sprite://11111111-1111-4111-8111-111111111111/auto/' + 'a'.repeat(64) + '.png';
  const crafting = [{ id: 'cactus', name: 'Cactus', emoji: '🌵', customSpriteUrl: ref }];
  const foundry = { materials: [], oddkinCollection: [], processes: [], experiments: [], habitats: [] };
  store.set('coco_kemon_save_v2', JSON.stringify({ version: 2, savedAt: 1, foundry, crafting }));
  const session = await load('sprite-ref-recovery');
  const loaded = session.readCraftElements();
  assert.equal(loaded.find(item => item.id === 'cactus')?.customSpriteUrl, ref);
  assert.equal(session.getSaveError(), null);
  session.saveCraftElements(loaded);
  assert.equal(session.getSaveError(), null);
  assert.equal(JSON.parse(store.get(session.SAVE_KEY)!).crafting.find((item: {id:string}) => item.id === 'cactus').customSpriteUrl, ref);
});

test('invalid existing data is not overwritten by a fallback save', async () => {
  store.clear();
  const invalid = '{"version":2,"savedAt":1,"foundry":null,"crafting":"invalid"}';
  store.set('coco_kemon_save_v2', invalid);
  const session = await load('save-recovery-protection');
  session.readCraftElements();
  session.saveCraftElements([{ id: 'water', name: 'Water', emoji: '💧' }]);
  assert.equal(store.get(session.SAVE_KEY), invalid);
  assert.match(session.getSaveError() || '', /could not be saved/i);
});
