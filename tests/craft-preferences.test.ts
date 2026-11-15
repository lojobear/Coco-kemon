import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCraftPreferences,readCraftPreferences,saveCraftPreferences,DEFAULT_CRAFT_PREFERENCES,CRAFT_PREFERENCES_KEY} from '../src/lib/craftPreferences';
test('craft settings validate malformed saves without losing independently valid choices',()=>{
 assert.deepEqual(parseCraftPreferences(null),DEFAULT_CRAFT_PREFERENCES);
 const saved=parseCraftPreferences({spawnCount:5,spawnSource:'shiny',spawnCategory:'Animals',spawnRarity:'epic',procedureId:'MELT',sortMode:'alpha',ingredientFilter:'shiny'});
 assert.equal(saved.spawnCount,5);assert.equal(saved.spawnCategory,'Animals');assert.equal(saved.procedureId,'MELT');
 const invalid=parseCraftPreferences({...saved,spawnCount:300,spawnSource:'unknown',spawnRarity:'secret',sortMode:'bad',procedureId:'<script>',spawnCategory:'x'.repeat(121)});
 assert.equal(invalid.spawnCount,2);assert.equal(invalid.spawnSource,'all');assert.equal(invalid.spawnCategory,'all');assert.equal(invalid.procedureId,'MIX');assert.equal(invalid.ingredientFilter,'shiny');
});
test('device craft preferences round-trip and tolerate unavailable storage',()=>{
 const before=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const data=new Map<string,string>();
 try {
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)}});
  saveCraftPreferences({...DEFAULT_CRAFT_PREFERENCES,spawnCount:10,spawnCategory:'Animals',procedureId:'FREEZE'});
  assert.equal(readCraftPreferences().spawnCount,10);assert.equal(readCraftPreferences().spawnCategory,'Animals');assert.equal(readCraftPreferences().procedureId,'FREEZE');
  data.set(CRAFT_PREFERENCES_KEY,'broken');assert.deepEqual(readCraftPreferences(),DEFAULT_CRAFT_PREFERENCES);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Storage blocked');}});
  assert.deepEqual(readCraftPreferences(),DEFAULT_CRAFT_PREFERENCES);assert.doesNotThrow(()=>saveCraftPreferences(DEFAULT_CRAFT_PREFERENCES));
 }finally{if(before)Object.defineProperty(globalThis,'localStorage',before);else delete (globalThis as any).localStorage;}
});
