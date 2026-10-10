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

// Each query string yields a fresh module instance, which is how we simulate separate tabs / page reloads.
const load = (tab: string) =>
  import(pathToFileURL(path.resolve('src/lib/saveData.ts')).href + `?${tab}`) as Promise<typeof import('../src/lib/saveData')>;
const emptyFoundry = { materials: [], oddkinCollection: [], processes: [], experiments: [], habitats: [] };

test('an oversized sprite is refused instead of locking the player out on the next launch', async () => {
  store.clear();
  const session = await load('sprite-1');
  const elements = [...session.readCraftElements()];
  const tooBig = 'data:image/png;base64,' + 'A'.repeat(session.MAX_SPRITE_CHARS + 1000);
  session.saveCraftElements([{ ...elements[0], customSpriteUrl: tooBig }, ...elements.slice(1)]);

  assert.match(session.getSaveError() || '', /sprite image is too large/i);
  assert.equal(store.get(session.SAVE_KEY), undefined, 'nothing invalid may be committed');

  const reloaded = await load('sprite-2');
  assert.equal(reloaded.readCraftElements().length, elements.length);
  assert.equal(reloaded.getSaveError(), null);
  reloaded.saveCraftElements([...reloaded.readCraftElements()]);
  assert.equal(reloaded.getSaveError(), null, 'saving must still work after a reload');
});

test('a stale tab cannot overwrite another tab\'s newer save, and an import can still replace it', async () => {
  store.clear();
  const a = await load('tab-a');
  const b = await load('tab-b');
  a.readCraftElements(); b.readCraftElements();

  const discovered = [...a.readCraftElements(), { id: 'pikachu', name: 'Pikachu', emoji: '⚡' }];
  a.saveCraftElements(discovered);
  b.saveFoundry(emptyFoundry);

  const saved = JSON.parse(store.get(a.SAVE_KEY)!);
  assert.ok(saved.crafting.some((e: { id: string }) => e.id === 'pikachu'), 'the discovery must survive');
  assert.match(b.getSaveError() || '', /another tab/i);

  a.saveCraftElements([...discovered, { id: 'mario', name: 'Mario', emoji: '🍄' }]);
  assert.equal(a.getSaveError(), null, 'the up-to-date tab keeps saving normally');

  b.importCompleteSave(a.exportCompleteSave(emptyFoundry));
  b.saveCraftElements([...b.readCraftElements()]);
  assert.equal(b.getSaveError(), null, 'an explicit import re-syncs the stale tab');
});
