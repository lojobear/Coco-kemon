import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRunwaySprite, RunwayPendingError, runwayJobKey, RUNWAY_SPRITE_MODEL, RUNWAY_API_URL } from '../server/runway';
import { readFileSync } from 'node:fs';

const DATA = new Uint8Array(160).fill(77);
function testKv(){
  const values=new Map<string,string>();
  return { values,
    async get(key:string){const x=values.get(key);return x ? JSON.parse(x):null;},
    async put(key:string,value:string){values.set(key,value);}
  };
}
function task(id='d2e3d1f4-1b3c-4b5c-8d46-1c1d7ee86892'){return id;}
test('Runway integration is disabled without opt-in, KV or a server key (zero credits)',async()=>{
  let calls=0;const fetcher=(async()=>{calls++;throw new Error('unwanted request');}) as typeof fetch;
  const kv=testKv();
  assert.equal(await generateRunwaySprite('test',{apiKey:'key',kv,fetcher,enabled:false}),null);
  assert.equal(await generateRunwaySprite('test',{apiKey:'',kv,fetcher,enabled:true}),null);
  assert.equal(await generateRunwaySprite('test',{apiKey:'key',fetcher,enabled:true,kv:undefined}),null);
  assert.equal(calls,0);
});

test('only creates one paid job, persists ID, polls later and converts the ephemeral image to durable base64',async()=>{
  const kv=testKv();
  const createdId=task();
  let creations=0,polls=0,downloads=0;
  const fetcher=(async(url:string|URL|Request,init?:RequestInit)=>{
    if(String(url)===RUNWAY_API_URL+'/text_to_image'){
      creations++;
      assert.equal(init?.method,'POST');
      const headers=init?.headers as Record<string,string>;
      assert.equal(headers.Authorization,'Bearer mock-key');
      assert.equal(headers['X-Runway-Version'],'2024-11-06');
      const data=JSON.parse(String(init?.body));
      assert.equal(data.model,RUNWAY_SPRITE_MODEL);
      assert.equal(data.ratio,'1024:1024');
      assert.equal(data.outputCount,1);
      assert.ok(data.promptText.includes('square pixel art'));
      return Response.json({id:createdId});
    }
    if(String(url)===RUNWAY_API_URL+'/tasks/'+createdId){
      polls++;
      return Response.json({id:createdId,status:polls===1?'RUNNING':'SUCCEEDED',output:['https://dnznrvs05pmza.cloudfront.net/render.png?token=temporary']});
    }
    if(String(url).startsWith('https://dnznrvs05pmza.cloudfront.net')){
      downloads++;
      return new Response(DATA,{headers:{'content-type':'image/png'}});
    }
    throw Error('Unexpected URL '+String(url));
  }) as typeof fetch;
  const options={apiKey:'mock-key',enabled:true,kv,fetcher};
  const prompt='square pixel art icon, single item';
  await assert.rejects(generateRunwaySprite(prompt,options),RunwayPendingError);
  assert.equal(creations,1);
  assert.ok(kv.values.has(runwayJobKey(prompt)));
  await assert.rejects(generateRunwaySprite(prompt,options),RunwayPendingError);
  assert.equal(creations,1);
  const done=await generateRunwaySprite(prompt,options);
  assert.equal(creations,1);
  assert.equal(polls,2);
  assert.equal(downloads,1);
  assert.equal(done?.mimeType,'image/png');
  assert.equal(done?.model,RUNWAY_SPRITE_MODEL);
  assert.equal(done?.data,Buffer.from(DATA).toString('base64'));
});

test('invalid Runway output URL is never downloaded as an SSRF target',async()=>{
  const kv=testKv();
  const prompt='do not download arbitrary host';
  const job=task();
  await kv.put(runwayJobKey(prompt),JSON.stringify({id:job,at:Date.now(),state:'pending'}));
  let hits=0;
  const fetcher=(async(url:string|URL|Request)=>{
    hits++;
    assert.equal(String(url),RUNWAY_API_URL+'/tasks/'+job);
    return Response.json({id:job,status:'SUCCEEDED',output:['https://evil.example/private-image.png']});
  }) as typeof fetch;
  assert.equal(await generateRunwaySprite(prompt,{apiKey:'mock',enabled:true,kv,fetcher}),null);
  assert.equal(hits,1);
});

test('failed paid task is remembered and never recreated automatically',async()=>{
  const kv=testKv();
  const prompt='difficult artwork';
  const job=task();
  await kv.put(runwayJobKey(prompt),JSON.stringify({id:job,at:Date.now(),state:'pending'}));
  let requests=0;
  const fetcher=(async()=>{requests++;return Response.json({id:job,status:'FAILED'});}) as typeof fetch;
  assert.equal(await generateRunwaySprite(prompt,{apiKey:'mock',enabled:true,kv,fetcher}),null);
  assert.equal(await generateRunwaySprite(prompt,{apiKey:'mock',enabled:true,kv,fetcher}),null);
  assert.equal(requests,1);
});

test('Runway remains available as a separate module but the restored image chain does not call it',()=>{
  const backend=readFileSync(new URL('../server/gemini.ts',import.meta.url),'utf8');
  assert.doesNotMatch(backend,/generateRunwaySprite|RUNWAYML_API_SECRET|RunwayPendingError/);
  assert.match(backend,/await generateWorkersAiImage\(prompt\)/);
  assert.match(backend,/process\.env\.GEMINI_API_KEY/);
  assert.match(readFileSync(new URL('../server/runway.ts',import.meta.url),'utf8'),/RUNWAY_SPRITES_ENABLED/);
});
