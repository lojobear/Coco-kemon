import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPersistentCacheBinding } from '../server/cacheBinding';
import { writePersistentJson } from '../server/persistentCache';
import { SPRITE_ENGINE_VERSION } from '../server/emoji';
import { normalizeRecoveryInput, recoveryKey, serverSpriteKey, registerRecoveryBatch, runRecoveryPass, RECOVERY_IMAGES_PER_CRON } from '../server/spriteRecovery';

const fakeArt={data:'A'.repeat(180),mimeType:'image/png',model:'@cf/black-forest-labs/flux-2-klein-4b'};
function mockKv() {
  const data=new Map<string,string>();
  return {
    data,
    get:async (key:string,_type?:'json'|'text')=>JSON.parse(data.get(key)||'null'),
    put:async (key:string,value:string)=>{data.set(key,value)},
    delete:async(key:string)=>{data.delete(key)},
    list:async ({prefix='',limit=1000,cursor}:{prefix?:string;limit?:number;cursor?:string})=>{
      const keys=[...data.keys()].filter(k=>k.startsWith(prefix)).sort();
      const begin=cursor?Number(cursor):0;
      const names=keys.slice(begin,begin+limit);
      return {keys:names.map(name=>({name})),list_complete:begin+limit>=keys.length,cursor:String(begin+limit)};
    },
  };
}
test('background sprite recovery validates inputs and shiny identities', ()=>{
  assert.deepEqual(normalizeRecoveryInput({name:'  Space  Rations ',shiny:false}),{name:'Space Rations',shiny:false});
  assert.equal(normalizeRecoveryInput({name:'',shiny:false}),null);
  assert.equal(normalizeRecoveryInput({name:'Tree',shiny:'yes'}),null);
  assert.notEqual(recoveryKey('Tree',false),recoveryKey('Tree',true));
  assert.match(serverSpriteKey('Tree',true),new RegExp('^'+SPRITE_ENGINE_VERSION));
  assert.equal(RECOVERY_IMAGES_PER_CRON,2);
});
test('recovery queue persists without user session, deduplicates tasks and skips finished art',async()=>{
  const kv=mockKv();setPersistentCacheBinding(kv);
  try {
    const original=await registerRecoveryBatch([{name:'Glassblowing',shiny:false},{name:'Glassblowing',shiny:false},{name:'Space Rations',shiny:true}]);
    assert.equal(original.added,2);
    const duplicate=await registerRecoveryBatch([{name:'Glassblowing',shiny:false}]);
    assert.equal(duplicate.waiting,1);
    assert.equal([...kv.data.keys()].filter(k=>k.startsWith('boop:recovery:v1:')).length,2);
    // A foreground session produced the sprite. The cron must NEVER bill to
    // generate a duplicate when cache artwork is available.
    await writePersistentJson('element-sprite-v9',serverSpriteKey('Glassblowing',false),fakeArt);
    process.env.BOOP_SAFE_SPENDING='1';
    const outcome=await runRecoveryPass(1);
    assert.equal(outcome.generated,0);
    assert.equal(outcome.ready,1);
    assert.equal(await kv.get('boop:recovery:v1:glassblowing'),null);
    const seen=await registerRecoveryBatch([{name:'Glassblowing',shiny:false}]);
    assert.deepEqual(seen.ready,['glassblowing']);
  }finally{setPersistentCacheBinding(undefined);delete process.env.BOOP_SAFE_SPENDING}
});
test('no AI generation when free-neuron reserve is near exhausted',async()=>{
  const kv=mockKv();setPersistentCacheBinding(kv);
  try{
    await registerRecoveryBatch([{name:'Boop Cactus',shiny:false}]);
    const day=new Date().toISOString().slice(0,10);
    await kv.put('boop:image-free-neurons:v1:'+day,JSON.stringify({neurons:4980}));
    process.env.BOOP_SAFE_SPENDING='1';
    const result=await runRecoveryPass();
    assert.deepEqual({generated:result.generated,ready:result.ready},{generated:0,ready:0});
  }finally{setPersistentCacheBinding(undefined);delete process.env.BOOP_SAFE_SPENDING}
});
test('scheduled recovery keeps existing spending safeguards and front-end auto sync',()=>{
  const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
  const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const client=readFileSync(new URL('../src/lib/spriteRecoveryClient.ts',import.meta.url),'utf8');
  assert.match(worker,/scheduled\(/);
  assert.match(worker,/runRecoveryPass\(/);
  assert.match(wrangler,/"crons": \["\*\/10 \* \* \* \*"\]/);
  assert.match(wrangler,/"BOOP_SAFE_SPENDING": "1"/);
  assert.match(app,/startSpriteRecovery/);
  assert.match(client,/SAVE_IMPORTED_EVENT/);
  assert.match(client,/getElementEmoji\(item.name,false,'',false,item.shiny\)/);
  assert.match(client,/syncRecoveryBatch/);
});
