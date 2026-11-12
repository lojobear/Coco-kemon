import test from 'node:test';import assert from 'node:assert/strict';
import { arenaFetch } from '../server/arenaApi';
test('Arena authenticates the account, reads its own cloud save and ignores submitted scores/inventories',async()=>{
 const user='11111111-1111-4111-8111-111111111111';let player:any;let readSave=0;let validAuth=true;let resumed:any=null;let picked:any;
 const original=globalThis.fetch;
 globalThis.fetch=async(input:any,init:any)=>{
  const url=String(input);
  if(url.endsWith('/auth/v1/user'))return validAuth?Response.json({id:user,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'}):Response.json({msg:'Invalid JWT'},{status:401});
  assert.ok(url.includes(`/rest/v1/game_saves?user_id=eq.${user}`));assert.equal(init.headers.Authorization,'Bearer test-token');readSave++;
  return Response.json([{payload:{crafting:[{id:'fox',name:'Fox',emoji:'🦊',craftCount:1}]}}]);
 };
 const stub={resume:async()=>resumed,queue:async(p:any,category:string)=>{player=p;return{phase:'waiting',category};},pick:async(id:string,key:string)=>{picked={id,key};return{phase:'picking'};}};
 const env:any={BOOP_ARENA:{getByName:()=>stub}};
 const request=(path:string,body?:any,token=true)=>new Request(`https://boop.test/api/arena/${path}`,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer test-token'}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await arenaFetch(request('collection',undefined,false),env)).status,401);assert.equal(readSave,0);
  const response=await arenaFetch(request('queue',{category:'Animals',user:'victim',cards:[{name:'Diamond',coins:999999}],coins:999999}),env);assert.equal(response.status,200);assert.equal(player.id,user);assert.equal(player.bot,false);assert.equal(player.cards.length,1);assert.equal(player.cards[0].name,'Fox');assert.notEqual(player.cards[0].coins,999999);assert.equal(readSave,1);
  assert.equal((await arenaFetch(request('queue',{category:'Vehicles'}),env)).status,400);
  resumed={phase:'waiting',category:'Animals'};const before=readSave;await arenaFetch(request('queue',{category:'Animals'}),env);assert.equal(readSave,before,'reconnect should reuse the frozen cloud collection');
  await arenaFetch(request('pick',{room:'match:11111111-1111-4111-8111-111111111111',key:'fox',user:'victim',coins:999999}),env);assert.deepEqual(picked,{id:user,key:'fox'});
  assert.equal((await arenaFetch(request('pick'),env)).status,405);
  validAuth=false;assert.equal((await arenaFetch(request('collection'),env)).status,401);
 }finally{globalThis.fetch=original;}
});
