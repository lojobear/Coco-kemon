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
const emptyFoundry = { materials: [], oddkinCollection: [], processes: [], experiments: [], habitats: [] };

test('a save from a newer build is refused, never overwritten, and says so', async () => {
  store.clear();
  const newer = JSON.stringify({ version: 4, savedAt: 1, foundry: emptyFoundry, crafting: [{ id: 'future', name: 'Future', emoji: '🔮' }] });
  store.set('coco_kemon_save_v2', newer);
  const session = await load('newer-save-1');
  session.readCraftElements();
  assert.match(session.getSaveError() || '', /newer version/i);
  // Even an explicit save attempt must not clobber the newer save.
  session.saveCraftElements([{ id: 'water', name: 'Water', emoji: '💧' }]);
  assert.equal(store.get(session.SAVE_KEY), newer, 'the newer save must survive untouched');
  assert.match(session.getSaveError() || '', /newer version/i);
});

test('parseSave rejects a newer backup version with the newer-save message', async () => {
  store.clear();
  const session = await load('newer-save-2');
  assert.throws(
    () => session.parseSave(JSON.stringify({ version: 99, foundry: emptyFoundry, crafting: [] })),
    /newer version/i,
  );
  // Versions 1 and 2 remain importable: version 1 is the legacy shape.
  assert.doesNotThrow(() => session.parseSave(JSON.stringify({ version: 1, materials: [], oddkinCollection: [], processes: [], experiments: [], habitats: [] })));
});
