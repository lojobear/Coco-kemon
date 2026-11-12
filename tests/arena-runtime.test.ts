import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('real Durable Objects match separate players, hide picks, reject outsiders, persist results and fill bots', {skip:process.env.ARENA_RUNTIME!=='1',timeout:120000},async()=>{
 const state=await mkdtemp(join(tmpdir(),'boop-arena-'));
 let worker:ReturnType<typeof spawn>;let logs='';
 const start=async()=>{
  worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','tests/arena.wrangler.jsonc','--ip','127.0.0.1','--port','3198','--persist-to',state],{env:{...process.env,XDG_CONFIG_HOME:join(state,'config'),WRANGLER_LOG_PATH:join(state,'wrangler.log')},stdio:['ignore','pipe','pipe']});
  worker.stdout?.on('data',chunk=>logs+=String(chunk));worker.stderr?.on('data',chunk=>logs+=String(chunk));
  for(let i=0;i<100;i++){if(worker.exitCode!==null)throw new Error(logs);try{await fetch('http://127.0.0.1:3198/');return;}catch{}await delay(200);}throw new Error(logs);
 };
 const stop=async()=>{if(worker&&worker.exitCode===null){worker.kill('SIGTERM');await new Promise(resolve=>worker.once('exit',resolve));}};
 const call=async(path:string,body:any,status=200)=>{const response=await fetch(`http://127.0.0.1:3198${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data:any=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;};
 const card=(key:string,coins:number)=>({key,name:key,emoji:'✨',category:'Animals',coins,form:'normal'});
 const alice={id:'alice',name:'Alice',bot:false,cards:[card('fox',100),card('whale',300)]};
 const bob={id:'bob',name:'Bob',bot:false,cards:[card('cat',200)]};
 try{
  await start();
  const timeoutRoom=`match:${crypto.randomUUID()}`;
  await call('/setup',{room:timeoutRoom,category:'Animals',players:[alice,bob]});
  const started=Date.now();
  const queued=await call('/queue',{category:'Animals',player:alice});assert.equal(queued.phase,'waiting');
  const duplicate=await call('/queue',{category:'Animals',player:alice});assert.equal(duplicate.botAt,queued.botAt);
  const matched=await call('/queue',{category:'Animals',player:bob});assert.equal(matched.phase,'picking');assert.equal(matched.opponent.bot,false);
  const a=await call('/queue',{category:'Animals',player:alice});assert.equal(a.room,matched.room);assert.equal(a.picks,undefined);assert.deepEqual(a.cards,alice.cards);assert.equal(a.opponent.cards,undefined);
  await call('/view',{room:a.room,user:'outsider'},400);
  await call('/pick',{room:a.room,user:'alice',key:'unowned',coins:999999},400);
  const locked=await call('/pick',{room:a.room,user:'alice',key:'fox',coins:999999});assert.equal(locked.picks,undefined);assert.equal(locked.locked,true);
  await call('/pick',{room:a.room,user:'alice',key:'whale'},400);
  const reveal=await call('/pick',{room:a.room,user:'bob',key:'cat'});assert.equal(reveal.phase,'finished');assert.equal(reveal.result,'win');assert.equal(reveal.picks.opponent.coins,100);
  await stop();await start();const recovered=await call('/view',{room:a.room,user:'alice'});assert.equal(recovered.result,'loss');assert.equal(recovered.picks.you.key,'fox');
  const simultaneous=Array.from({length:4},(_,index)=>({...alice,id:`parallel-${index}`,cards:alice.cards.map(card=>({...card,category:'Parallel'}))}));
  await Promise.all(simultaneous.map(player=>call('/queue',{category:'Parallel',player})));
  const assigned=await Promise.all(simultaneous.map(player=>call('/queue',{category:'Parallel',player})));
  assert.equal(new Set(assigned.map(view=>view.room)).size,2,'four simultaneous players must form exactly two matches');
  const solo={...alice,id:'solo',cards:[{...card('fox',100),category:'Unique test category'}]};
  await call('/queue',{category:'Unique test category',player:solo});await delay(12200);
  const bot=await call('/queue',{category:'Unique test category',player:solo});assert.equal(bot.phase,'picking');assert.equal(bot.opponent.bot,true);assert.equal(bot.opponent.locked,true);assert.equal(bot.picks,undefined);
  const botResult=await call('/pick',{room:bot.room,user:'solo',key:'fox'});assert.equal(botResult.phase,'finished');assert.ok(['win','loss','draw'].includes(botResult.result));
  const forfeitRoom=`match:${crypto.randomUUID()}`;await call('/setup',{room:forfeitRoom,category:'Animals',players:[alice,bob]});await call('/leave',{room:forfeitRoom,user:'alice'});assert.equal((await call('/view',{room:forfeitRoom,user:'bob'})).result,'win');
  await delay(Math.max(0,45500-(Date.now()-started)));const expired=await call('/view',{room:timeoutRoom,user:'alice'});assert.equal(expired.phase,'finished');assert.equal(expired.result,'draw');assert.equal(expired.picks.you,null);
 }finally{await stop();await rm(state,{recursive:true,force:true});}
});
