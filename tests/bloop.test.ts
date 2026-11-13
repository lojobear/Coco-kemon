import test from 'node:test';
import assert from 'node:assert/strict';
import { newBloopState, chooseBloopRecipe, applyBloopRecipe, bloopSlot } from '../src/lib/bloop';
import { BoopImageBudgetLedger } from '../server/imageBudgetLedger';
import { BLOOP_DAILY_IMAGE_NEURON_LIMIT, BOOP_DAILY_IMAGE_NEURON_LIMIT } from '../server/imageSpendingGuard';
import { readFileSync } from 'node:fs';
test('Bloop begins with only starters and chooses real owned recipes',async()=>{
  const state=newBloopState();assert.equal(state.items.length,4);assert.equal(state.crafts,0);
  const selected=await chooseBloopRecipe(state,async()=>undefined,()=>1);
  assert.ok(selected.recipe);assert.equal(selected.strategy,'curious');
  const next=applyBloopRecipe(state,selected.recipe!,900000);
  assert.equal(next.state.crafts,1);assert.ok(next.state.items.length>=5);
  assert.equal(state.items.length,4);assert.equal(next.detail.status,'crafted');
  assert.equal(bloopSlot(899999),0);assert.equal(bloopSlot(900000),1);
});
test('random mode never calls a text generation provider and respects owned ingredients',async()=>{
  const state=newBloopState();let calls=0;
  const result=await chooseBloopRecipe(state,async()=>{calls++;return undefined;},()=>0);
  assert.ok(result.recipe);assert.equal(result.strategy,'random');assert.ok(calls<=4);
  assert.throws(()=>applyBloopRecipe(state,{first:'Unowned',second:'Fire',outcome:{result:'Steam',emoji:'💨',isNew:false}},0));
});
test('bot reservation is atomic with both the 1,000 bot cap and shared 10,000 cap',async()=>{
  const map=new Map<string,unknown>();let tail=Promise.resolve();
  const storage={get:async<T>(key:string)=>map.get(key) as T|undefined,transaction:async<T>(fn:any):Promise<T>=>{const previous=tail;let release!:()=>void;tail=new Promise<void>(r=>release=r);await previous;try{return await fn({get:storage.get,put:async(key:string,value:unknown)=>{map.set(key,value);}});}finally{release();}}};
  const ledger=new BoopImageBudgetLedger({storage});
  const reserve=async(neurons:number,scope?:'bloop',day='2026-11-13')=>await (await ledger.fetch(new Request('https://budget.internal/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day,neurons,scope,floor:0})}))).json() as {allowed:boolean;used:number;botUsed:number};
  assert.equal(BLOOP_DAILY_IMAGE_NEURON_LIMIT,1000);assert.equal(BOOP_DAILY_IMAGE_NEURON_LIMIT,10000);
  assert.equal((await reserve(900,'bloop')).allowed,true);
  const races=await Promise.all([reserve(80,'bloop'),reserve(80,'bloop')]);assert.equal(races.filter(x=>x.allowed).length,1);
  assert.equal((await reserve(20,'bloop')).botUsed,1000);
  assert.equal((await reserve(1,'bloop')).allowed,false);
  assert.equal((await reserve(9000)).used,10000);
  assert.equal((await reserve(1)).allowed,false);
  assert.equal((await reserve(1000,'bloop','2026-11-14')).allowed,true);
  assert.equal((await reserve(9001,undefined,'2026-11-14')).allowed,false);
});
test('Bloop cron is isolated from existing recovery and uses only free Workers AI',()=>{
  const config=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  assert.match(config,/\*\/10 \* \* \* \*/);assert.match(config,/\*\/15 \* \* \* \*/);
  const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');assert.match(worker,/runBloopTick/);
  const server=readFileSync(new URL('../server/bloop.ts',import.meta.url),'utf8');assert.match(server,/generateBloopImage/);assert.doesNotMatch(server,/generateGeminiImage\(/);
});
