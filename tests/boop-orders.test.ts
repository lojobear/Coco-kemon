import test from 'node:test';
import assert from 'node:assert/strict';
import {activeOrders,applyOrderDelivery,applyBoardDecoration,orderGuide} from '../src/lib/boopOrders';
import {emptyOrderProgress,orderReputation,validOrderProgress} from '../src/lib/orderProgress';
import {emptyEconomy,availableCopies,applySale,validEconomy} from '../src/lib/economy';
import {BUILT_IN_PAIR_RECIPES} from '../src/lib/builtInPairs';
import {makePairKey,type InfiniteElement} from '../src/lib/infiniteCraftData';
const steam:InfiniteElement={id:'steam',name:'Steam',emoji:'💨',craftCount:4,copyCounts:{normal:3,shiny:1,holo:0,celestial:0,glitch:0},unlockedShiny:true,customSpriteUrl:'data:image/png;base64,kept',discoveredAt:123,recipe:{first:'Water',second:'Fire'}};

test('every rotating request has a verified, starter-reachable recipe and three independent slots',()=>{
 const progress=emptyOrderProgress();const seen=new Set<string>();
 for(let n=0;n<12;n++){
  const orders=activeOrders(progress);assert.equal(orders.length,3);
  for(const order of orders){seen.add(order.id);for(const name of order.accepts){
   const guide=orderGuide(name);assert.ok(guide.length>0,name);const owned=new Set(['Water','Fire','Wind','Earth']);
   for(const step of guide){assert.ok(owned.has(step.first)&&owned.has(step.second));assert.equal(BUILT_IN_PAIR_RECIPES[makePairKey(step.first,step.second)]?.result,step.result);owned.add(step.result);}
   assert.ok(owned.has(name));
  }}
  progress.cycles=progress.cycles.map(count=>count+1) as typeof progress.cycles;
 }
 assert.equal(seen.size,10);
});

test('delivery pays once, changes only its own request, protects art and special copies, and shares stock with sales',()=>{
 const collection=[steam],before=JSON.stringify(collection),economy=emptyEconomy(),orders=activeOrders();
 const result=applyOrderDelivery(economy,collection,orders[0].ticket,'  STEAM  ');
 assert.ok(result.reward>0);assert.equal(result.economy.coins,result.reward);assert.equal(result.economy.orders?.delivered.steam,1);
 assert.equal(availableCopies(steam,result.economy,'normal'),2);assert.equal(availableCopies(steam,result.economy,'shiny'),1);
 assert.equal(JSON.stringify(collection),before);assert.deepEqual(result.economy.sold,{});
 assert.equal(orderReputation(result.economy.orders!),1);
 assert.equal(activeOrders(result.economy.orders)[1].ticket,orders[1].ticket);
 assert.throws(()=>applyOrderDelivery(result.economy,collection,orders[0].ticket,'Steam'),/changed/);
 assert.throws(()=>applyOrderDelivery(economy,collection,orders[1].ticket,'Steam'),/match/);
 const sold=applySale(steam,result.economy,'normal',2,collection).economy;
 assert.deepEqual(sold.orders,result.economy.orders);assert.equal(availableCopies(steam,sold,'normal'),0);
 assert.throws(()=>applySale(steam,sold,'normal'),/Not enough/);
 const one={...steam,craftCount:1,copyCounts:{normal:1,shiny:0,holo:0,celestial:0,glitch:0}};
 const exhausted=applySale(one,economy,'normal').economy;
 assert.throws(()=>applyOrderDelivery(exhausted,[one],orders[0].ticket,'Steam'),/Craft another/);
 const specialOnly={...steam,craftCount:1,copyCounts:{normal:0,shiny:1,holo:0,celestial:0,glitch:0}};
 assert.throws(()=>applyOrderDelivery(economy,[specialOnly],orders[0].ticket,'Steam'),/normal copy/);
});

test('reputation unlocks cosmetic boards, validates imported state and prevents locked equips',()=>{
 const economy=emptyEconomy();assert.ok(validEconomy(economy));assert.throws(()=>applyBoardDecoration(economy,'stars'),/reputation/);
 const progress={...emptyOrderProgress(),cycles:[3,0,0] as [number,number,number]};
 const equipped=applyBoardDecoration({...economy,orders:progress},'stars');assert.equal(equipped.orders?.decoration,'stars');assert.ok(validEconomy(equipped));
 assert.equal(validOrderProgress({...progress,cycles:[-1,0,0]}),false);
 assert.equal(validOrderProgress({...progress,decoration:'orbits'}),false);
 assert.equal(validOrderProgress({...progress,delivered:{Steam:1}}),false);
 assert.equal(validOrderProgress({...progress,delivered:{steam:-1}}),false);
 assert.equal(validEconomy({...economy,orders:{}}),false);
 assert.throws(()=>applyOrderDelivery({...economy,coins:Number.MAX_SAFE_INTEGER},[steam],activeOrders()[0].ticket,'Steam'),/Wallet limit/);
});

test('order claims commit atomically, survive save/export/import and roll back on disk failure',async()=>{
 const values=new Map<string,string>();Object.assign(globalThis,{window:new EventTarget(),localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
 const {pathToFileURL}=await import('node:url');const path=await import('node:path');
 const session=await import(pathToFileURL(path.resolve('src/lib/saveData.ts')).href+'?orders-durable');
 const foundry={materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]};
 const sand={...steam,id:'sand',name:'Sand',emoji:'🏖️'},wren={...steam,id:'wren',name:'Storm Wren',emoji:'🐦'};
 const collection=[steam,sand,wren];let fail=false;
 let saved:any={revision:1,envelope:{version:3,savedAt:1,foundry,crafting:collection,economy:emptyEconomy()}};
 const db={read:async()=>structuredClone(saved),commit:async(envelope:any,expected:number)=>{assert.equal(expected,saved.revision);if(fail)throw new Error('Disk full');saved={revision:expected+1,envelope:structuredClone(envelope)};return structuredClone(saved);},close(){}};
 await session.initializeLocalSave(async()=>db);
 const ticket=activeOrders()[0].ticket;
 const claims=await Promise.allSettled([session.commitOrderAction({ticket,name:'Steam'}),session.commitOrderAction({ticket,name:'Steam'})]);
 assert.equal(claims.filter(c=>c.status==='fulfilled').length,1);
 assert.equal(saved.envelope.economy.orders.delivered.steam,1);
 assert.equal(session.readCraftElements().find(item=>item.name==='Steam')?.customSpriteUrl,steam.customSpriteUrl);
 const backup=session.exportCompleteSave(foundry);assert.deepEqual(session.parseSave(backup).economy.orders,saved.envelope.economy.orders);
 const before=JSON.stringify(saved);fail=true;
 await assert.rejects(session.commitOrderAction({ticket:activeOrders(session.readEconomy().orders)[1].ticket,name:'Sand'}),/Disk full/);
 assert.equal(JSON.stringify(saved),before);assert.equal(session.readEconomy().orders?.delivered.sand,undefined);
 fail=false;await session.importCompleteSaveDurably(backup);
 await session.commitOrderAction({ticket:activeOrders(session.readEconomy().orders)[2].ticket,name:'Storm Wren'});
 await session.commitOrderAction({decoration:'stars'});
 session.saveCraftElements([...session.readCraftElements(),{id:'extra',name:'Extra',emoji:'✨'}]);await session.waitForLocalSave();
 assert.equal(session.readEconomy().orders?.decoration,'stars');
 await session.importCompleteSaveDurably(session.exportCompleteSave(foundry));
 assert.equal(session.readEconomy().orders?.decoration,'stars');
 assert.equal(session.readEconomy().orders?.delivered['storm wren'],1);
});
