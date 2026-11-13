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

test('IndexedDB migration verifies old collection before replacing only its localStorage pointer',async()=>{
 store.clear();const legacy=await load('idb-legacy');const items=Array.from({length:4000},(_,i)=>({id:'item_'+i,name:'Item '+i,emoji:'✨',explanation:'A unique collected discovery.',recipe:{first:'Fire',second:'Water'}}));
 legacy.readCraftElements();legacy.saveCraftElements(items);const old=store.get(legacy.SAVE_KEY)!;
 const {LocalSaveConflict}=await import('../src/lib/localSaveDatabase');
 let current:any=null,original:string|undefined,recovery:string|null=null,fail=false;
 const db={read:async()=>structuredClone(current),commit:async(envelope:any,expected:number,backup?:string)=>{if(fail)throw new Error('test transaction failure');if((current?.revision??0)!==expected)throw new LocalSaveConflict();if(backup!==undefined)original=backup;current={revision:expected+1,envelope:structuredClone(envelope)};return structuredClone(current);},recovery:async(value?:string)=>{if(value!==undefined)recovery=value;return recovery;}};
 const a=await load('idb-migrate');await a.initializeLocalSave(async()=>db);
 assert.equal(a.getLocalSaveBackend(),'IndexedDB');assert.equal(original,old);assert.equal(JSON.parse(store.get(a.SAVE_KEY)!).version,6);assert.deepEqual(a.readCraftElements(),items);
 const localBefore=store.get(a.SAVE_KEY)!;assert.ok(localBefore.length<200);
 const b=await load('idb-second-tab');await b.initializeLocalSave(async()=>db);
 const next=[...items,{id:'new',name:'New',emoji:'✨'}];a.saveCraftElements(next);await a.waitForLocalSave();assert.equal(current.envelope.crafting.length,4001);
 b.saveCraftElements([...items,{id:'stale',name:'Stale',emoji:'✨'}]);await assert.rejects(b.waitForLocalSave(),/another tab/i);assert.equal(current.envelope.crafting.length,4001);assert.ok(JSON.parse(b.exportCompleteSave(emptyFoundry)).crafting.some((x:any)=>x.id==='stale'));
 const c=await load('idb-reload');await c.initializeLocalSave(async()=>db);assert.deepEqual(c.readCraftElements(),next);
 fail=true;const pending=[...next,{id:'pending',name:'Pending',emoji:'✨'}];c.saveCraftElements(pending);await assert.rejects(c.waitForLocalSave());assert.equal(current.envelope.crafting.length,4001);assert.equal(c.readCraftElements().length,4002);assert.match(c.getSaveError()||'',/IndexedDB/i);
 fail=false;await c.waitForLocalSave();assert.equal(current.envelope.crafting.length,4002);assert.equal(c.getSaveError(),null);
 await c.keepLocalRecovery('backup');assert.equal(await c.readLocalRecovery(),'backup');
 assert.equal(JSON.parse(c.exportCompleteSave(emptyFoundry)).version,3);
});
test('IndexedDB marker never silently falls back to an empty local game',async()=>{
 store.clear();const session=await load('idb-unavailable');
 store.set(session.SAVE_KEY,JSON.stringify({version:6,savedAt:1,encoding:'boop-indexeddb-v1'}));
 await assert.rejects(session.initializeLocalSave(async()=>{throw new Error('blocked');}),/blocked/);
 assert.equal(JSON.parse(store.get(session.SAVE_KEY)!).version,6);
});
test('failed migration leaves original localStorage bytes untouched',async()=>{
 store.clear();const legacy=await load('idb-failure-legacy');legacy.readCraftElements();legacy.saveCraftElements(legacy.readCraftElements());const raw=store.get(legacy.SAVE_KEY);
 const session=await load('idb-failure');await assert.rejects(session.initializeLocalSave(async()=>({read:async()=>null,commit:async()=>{throw new Error('disk full');},recovery:async()=>null})),/disk full/);
 assert.equal(store.get(legacy.SAVE_KEY),raw);
});
test('failed durable import never replaces the live collection',async()=>{
 store.clear();let current:any=null,fail=false;
 const db={read:async()=>structuredClone(current),commit:async(envelope:any,expected:number)=>{if(fail)throw new Error('disk full');current={revision:expected+1,envelope:structuredClone(envelope)};return structuredClone(current);},recovery:async()=>null};
 const a=await load('idb-import');await a.initializeLocalSave(async()=>db);const original=a.readCraftElements();
 const json=JSON.stringify({version:3,crafting:[{id:'replacement',name:'Replacement',emoji:'✨'}],foundry:emptyFoundry,economy:{version:1,coins:0,sold:{}}});
 fail=true;await assert.rejects(a.importCompleteSaveDurably(json),/disk full/);assert.deepEqual(a.readCraftElements(),original);assert.deepEqual(current.envelope.crafting,original);
 fail=false;await a.importCompleteSaveDurably(json);assert.equal(a.readCraftElements()[0].id,'replacement');assert.equal(current.envelope.crafting[0].id,'replacement');
});
