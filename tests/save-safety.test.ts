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


test('quota fallback stores exact sprite art and progress atomically and reloads with v3 cloud exports',async()=>{
 store.clear();
 const session=await load('compact-quota');
 const original=globalThis.localStorage.setItem;
 const ref='sprite://11111111-1111-4111-8111-111111111111/auto/'+'a'.repeat(64)+'.png';
 const sprite='data:image/png;base64,'+'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/'.repeat(450)+'==';
 const items=[{id:'a',name:'Alpha',emoji:'🧩',customSpriteUrl:sprite},{id:'b',name:'Beta',emoji:'🧩',customSpriteUrl:sprite},{id:'c',name:'Cactus',emoji:'🌵',customSpriteUrl:ref}];
 const quota=20000;
 globalThis.localStorage.setItem=(key,value)=>{if(value.length>quota)throw new DOMException('Quota full','QuotaExceededError');original(key,value);};
 try{
  session.readCraftElements();
  session.saveCraftElements(items);
  assert.equal(session.getSaveError(),null);
  const packed=JSON.parse(store.get(session.SAVE_KEY)!);
  assert.equal(packed.version,4);assert.equal(packed.sprites.length,1);
  const reloaded=await load('compact-quota-reload');
  assert.deepEqual(reloaded.readCraftElements(),items);
  const exported=JSON.parse(reloaded.exportCompleteSave(emptyFoundry));
  assert.equal(exported.version,3);assert.deepEqual(exported.crafting,items);
  assert.deepEqual(reloaded.parseSave(JSON.stringify(exported)).crafting,items);
  reloaded.saveCraftElements([...items,{id:'new',name:'New',emoji:'✨'}]);
  assert.equal(reloaded.getSaveError(),null);
  const second=await load('compact-quota-second');assert.equal(second.readCraftElements().length,4);
 }finally{globalThis.localStorage.setItem=original;}
});
test('failed compact save leaves durable data intact and reports the quota while exporting pending discoveries',async()=>{
 store.clear();const session=await load('compact-too-full');
 const items=[...session.readCraftElements()];session.saveCraftElements(items);
 const old=store.get(session.SAVE_KEY);
 const original=globalThis.localStorage.setItem;
 globalThis.localStorage.setItem=()=>{throw new DOMException('Quota full','QuotaExceededError');};
 try{
  const next=[...items,{id:'new',name:'New',emoji:'✨',customSpriteUrl:'data:image/png;base64,'+'A'.repeat(1000)}];
  session.saveCraftElements(next);
  assert.match(session.getSaveError()||'',/device storage is full/i);
  assert.equal(store.get(session.SAVE_KEY),old);
  assert.ok(JSON.parse(session.exportCompleteSave(emptyFoundry)).crafting.some((x:{id:string})=>x.id==='new'));
 }finally{globalThis.localStorage.setItem=original;}
});
test('packed sprite dictionary round trips every base64 symbol, padding and non-image metadata',async()=>{
 const {encodePackedLocalSave,decodePackedLocalSave}=await import('../src/lib/packedLocalSave');
 const values=['A','AB','ABC','ABCD','ABC=','AB==','ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/','////','+++/'];
 const envelope={version:3,savedAt:20,foundry:null,crafting:values.map((v,i)=>({id:String(i),name:'月🪐',emoji:'✨',customSpriteUrl:'data:image/png;base64,'+v})),economy:{},collectorRoom:{},boardLayout:[]};
 assert.deepEqual(decodePackedLocalSave(JSON.parse(encodePackedLocalSave(envelope))),envelope);
});

test('large metadata collections survive localStorage quota and reload without dropping discoveries',async()=>{
 store.clear();const session=await load('large-metadata-quota');
 const items=Array.from({length:3000},(_,i)=>({id:'item_'+i,name:'Discovery '+i,emoji:'✨',category:'Technology',explanation:'A recognizable discovery from two ingredients.',recipe:{first:'Water',second:'Fire'},customSpriteUrl:'sprite://11111111-1111-4111-8111-111111111111/auto/'+(i.toString(16).padStart(64,'0'))+'.png'}));
 const original=globalThis.localStorage.setItem;
 globalThis.localStorage.setItem=(key,value)=>{if(value.length>350000)throw new DOMException('Quota full','QuotaExceededError');original(key,value);};
 try{
  session.readCraftElements();session.saveCraftElements(items);
  assert.equal(session.getSaveError(),null);assert.equal(JSON.parse(store.get(session.SAVE_KEY)!).version,5);
  const reloaded=await load('large-metadata-reload');assert.deepEqual(reloaded.readCraftElements(),items);
  reloaded.saveCraftElements([...items,{id:'next',name:'Next',emoji:'✨'}]);assert.equal(reloaded.getSaveError(),null);
  assert.equal((await load('large-metadata-reload2')).readCraftElements().length,3001);
  assert.equal(JSON.parse(reloaded.exportCompleteSave(emptyFoundry)).version,3);
 }finally{globalThis.localStorage.setItem=original;}
});
test('lossless general compression round trips unicode and dictionary resets',async()=>{
 const {encodeCompressedLocalSave,decodeCompressedLocalSave}=await import('../src/lib/compressedLocalSave');
 let seed=12345;const random=Array.from({length:80000},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return String.fromCharCode(32+(seed>>>16)%90);}).join('');
 const envelope={version:3,savedAt:44,crafting:[{name:'月🪐',emoji:'✨',random}],foundry:null};
 const packed=JSON.parse(encodeCompressedLocalSave(envelope));assert.deepEqual(decodeCompressedLocalSave(packed),envelope);
 assert.throws(()=>decodeCompressedLocalSave({...packed,bytes:1}));
});
test('different discovery names with the same sanitized id never invalidate the save',async()=>{
 const {applySharedPairDiscovery}=await import('../src/lib/sharedCraftingEngine');
 const existing=[{id:'a_b',name:'A-B',emoji:'✨'}];
 const result=applySharedPairDiscovery(existing,{result:'A B',emoji:'✨',isNew:false},'Water','Fire',{shiny:false,celestial:false,holo:false,glitch:false,tier:'common'},1);
 assert.notEqual(result.main.id,existing[0].id);
 assert.equal(new Set(result.elements.map(x=>x.id)).size,result.elements.length);
});
