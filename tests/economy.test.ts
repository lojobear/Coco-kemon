import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { emptyEconomy, availableCopies, applySale, validEconomy } from '../src/lib/economy';
import { earnedCopyCounts } from '../src/lib/elementCopies';
import { elementValue, buildCollectionValueBook, elementValueKey } from '../src/lib/elementValue';
import { applySharedPairDiscovery } from '../src/lib/sharedCraftingEngine';
import type { InfiniteElement } from '../src/lib/infiniteCraftData';

const store = new Map<string,string>();
let quota = false;
Object.assign(globalThis,{localStorage:{getItem:(key:string)=>store.get(key)??null,
  setItem:(key:string,value:string)=>{if(quota)throw new Error('Quota exceeded');store.set(key,value);},removeItem:(key:string)=>store.delete(key)},window:new EventTarget(),document:new EventTarget()});
const load=(id:string)=>import(pathToFileURL(path.resolve('src/lib/saveData.ts')).href+'?economy-'+id) as Promise<typeof import('../src/lib/saveData')>;
const foundry={materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]};
const item:InfiniteElement={id:'steam',name:'Steam',emoji:'💨',craftCount:1,recipe:{first:'Water',second:'Fire'},discoveredAt:Date.now()};
function seed(){store.clear();quota=false;store.set('coco_kemon_save_v2',JSON.stringify({version:2,savedAt:1,foundry,crafting:[item]}));}

test('supplied starters have no stock; each new craft earns one highest rolled form',()=>{
  assert.equal(availableCopies({id:'water',name:'Water',emoji:'💧'},emptyEconomy(),'normal'),0);
  const a=applySharedPairDiscovery([],{result:'Steam',emoji:'💨',isNew:false},'Water','Fire',
    {tier:'rare',shiny:true,holo:true,celestial:true,glitch:true},Date.now()).main;
  assert.deepEqual(earnedCopyCounts(a),{normal:0,shiny:0,holo:0,celestial:0,glitch:1});
  const b=applySharedPairDiscovery([a],{result:'Steam',emoji:'💨',isNew:false},'Water','Fire',
    {tier:'common',shiny:false,holo:false,celestial:false,glitch:false},Date.now()).main;
  assert.deepEqual(earnedCopyCounts(b),{normal:1,shiny:0,holo:0,celestial:0,glitch:1});
  const sold=applySale(b,emptyEconomy(),'glitch');
  assert.equal(sold.proceeds,elementValue(b,'glitch').coins);
  assert.equal(availableCopies(b,sold.economy,'glitch'),0);
  assert.equal(availableCopies(b,sold.economy,'normal'),1);
  assert.throws(()=>applySale(b,sold.economy,'glitch'),/Not enough/);
  assert.throws(()=>applySale(b,sold.economy,'normal',-1),/Not enough/);
});

test('legacy overlapping special flags never mint more copies than total crafts',()=>{
  const counts=earnedCopyCounts({...item,craftCount:1,unlockedGlitch:true,unlockedCelestial:true,unlockedShiny:true,shinyCraftCount:1});
  assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),1);
  assert.equal(counts.glitch,1);
  assert.equal(counts.normal,0);
});

test('a durable sale credits exactly once, retains the discovery, and survives reload and backup import',async()=>{
  seed();const a=await load('durable-a');a.readCraftElements();
  const result=a.sellElement('STEAM','normal');
  assert.equal(result.proceeds,elementValue(item,'normal').coins);
  assert.equal(a.readEconomy().coins,result.proceeds);
  assert.equal(a.readCraftElements().length,1);
  assert.equal(a.readCraftElements()[0].craftCount,1);
  assert.throws(()=>a.sellElement('Steam','normal'),/Not enough/);
  const b=await load('durable-b');assert.equal(b.readEconomy().coins,result.proceeds);
  assert.throws(()=>b.sellElement('Steam','normal'),/Not enough/);
  const backup=a.exportCompleteSave(foundry);assert.equal(JSON.parse(backup).version,3);
  b.importCompleteSave(backup);assert.equal(b.readEconomy().coins,result.proceeds);
  assert.equal(availableCopies(item,b.readEconomy(),'normal'),0);
  assert.throws(()=>b.importCompleteSave(JSON.stringify({...JSON.parse(backup),economy:{version:1,coins:-1,sold:{}}})),/wallet/i);
  b.importCompleteSave(JSON.stringify({version:1,...foundry}));
  assert.equal(b.readEconomy().coins,result.proceeds);
  assert.equal(availableCopies(item,b.readEconomy(),'normal'),0);
  b.importCompleteSave(JSON.stringify({version:2,foundry,crafting:[item]}));
  assert.deepEqual(b.readEconomy(),emptyEconomy());
});

test('quota errors leave both coins and sale receipts untouched',async()=>{
  seed();const a=await load('quota');a.readCraftElements();const before=store.get(a.SAVE_KEY);
  quota=true;assert.throws(()=>a.sellElement('Steam','normal'),/Quota/);quota=false;
  assert.equal(store.get(a.SAVE_KEY),before);assert.equal(a.readEconomy().coins,0);
  assert.equal(availableCopies(item,a.readEconomy(),'normal'),1);
});

test('stale tabs cannot sell a copy that another tab already sold',async()=>{
  seed();const a=await load('tab-a'),b=await load('tab-b');a.readCraftElements();b.readCraftElements();
  a.sellElement('Steam','normal');const raw=store.get(a.SAVE_KEY);
  assert.throws(()=>b.sellElement('Steam','normal'),/another tab/i);
  assert.equal(store.get(a.SAVE_KEY),raw);
});

test('wallet validation rejects malformed receipt counts and unsafe coin amounts',()=>{
  assert.equal(validEconomy({version:1,coins:Infinity,sold:{}}),false);
  assert.equal(validEconomy({version:1,coins:1.5,sold:{}}),false);
  assert.equal(validEconomy({version:1,coins:10,sold:{steam:{normal:-1}}}),false);
  assert.equal(validEconomy({version:1,coins:10,sold:{steam:{madeUp:1}}}),false);
});


test('selling flushes an outstanding craft save and rejects a changed quote without spending a copy',async()=>{
  seed();const a=await load('queued');a.readCraftElements();
  a.queueCraftElementsSave([{...item,craftCount:2}]);
  assert.throws(()=>a.sellElement('Steam','normal',1,999999),/Value changed/);
  assert.equal(a.readEconomy().coins,0);
  assert.equal(a.readCraftElements()[0].craftCount,2);
  a.sellElement('Steam','normal',1,elementValue(item,'normal').coins);
  assert.equal(availableCopies(a.readCraftElements()[0],a.readEconomy(),'normal'),1);
});


test('sale credits the exact collision-resolved collection quote and never trusts old prices',()=>{
  const owned=Array.from({length:330},(_,index):InfiniteElement=>({
    id:'coin-'+index,name:'Coin Test '+String(index).padStart(4,'0'),emoji:'🪙',craftCount:2,
  }));
  const book=buildCollectionValueBook(owned);
  const first=owned[0];
  const price=book.get(elementValueKey(first.name,'normal'))!;
  const result=applySale(first,emptyEconomy(),'normal',1,owned);
  assert.equal(result.price,price);
  assert.equal(result.proceeds,price);
  assert.equal(result.economy.coins,price);
  assert.equal(availableCopies(first,result.economy,'normal'),1);
});
