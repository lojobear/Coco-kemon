import type { Express } from 'express';
import { getPersistentCacheBinding } from './cacheBinding.js';
import { readPersistentJson, cachedWork } from './persistentCache.js';
import { buildSpritePrompt } from './emoji.js';
import { findRecoveryArt, serverSpriteKey } from './spriteRecovery.js';
import { generateBloopImage, type GeminiImageResult } from './gemini.js';
import { getBloopImageNeuronsUsed, getImageNeuronsUsed, BLOOP_DAILY_IMAGE_NEURON_LIMIT, BOOP_DAILY_IMAGE_NEURON_LIMIT, safeImageSpendingEnabled, utcBudgetDay } from './imageSpendingGuard.js';
import { bloopSlot, chooseBloopRecipe, applyBloopRecipe, newBloopState, type BloopState, type BloopActivity } from '../src/lib/bloop.js';
import { discoveryIdentity } from '../src/lib/unifiedCollection.js';

const SUPABASE_URL='https://lrjszbguvqgdsqvvcoqe.supabase.co';
const KEY='sb_publishable_y7dGWisvgKzLvRVpbzd0zw_BISm05fI';
const TOKEN_KEY='boop:bloop:db-token:v1';
async function credential():Promise<string|undefined>{
  // Prefer a Worker secret; private KV fallback is scoped to only two bot RPCs.
  const value=process.env.BLOOP_DB_TOKEN || await getPersistentCacheBinding()?.get(TOKEN_KEY,'text');
  return typeof value==='string'&&/^[a-f0-9-]{36}\.[a-f0-9-]{36}$/.test(value)?value:undefined;
}
async function rpc<T>(name:'bloop_claim'|'bloop_finish',token:string,body:Record<string,unknown>):Promise<T>{
  const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_token:token,...body}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Bloop database RPC failed: '+response.status);
  return await response.json() as T;
}
export async function runBloopTick(scheduledTime=Date.now()){
  if(!safeImageSpendingEnabled())return {status:'safe-mode-required'};
  const token=await credential();if(!token)return {status:'database-not-configured'};
  const slot=bloopSlot(scheduledTime);
  const claim=await rpc<{claimed:boolean;state?:BloopState}>('bloop_claim',token,{p_slot:slot});
  if(!claim.claimed)return {status:'paused-or-already-ran'};
  let state=claim.state?.items?.length?claim.state:newBloopState();
  let detail:BloopActivity={status:'idle'};
  try{
    const selected=await chooseBloopRecipe(state,key=>readPersistentJson('infinite-pair-v4',key));
    if(selected.recipe){const next=applyBloopRecipe(state,selected.recipe,scheduledTime);state=next.state;detail={...next.detail,strategy:selected.strategy};}
    else detail={status:'idle',strategy:selected.strategy,message:'No available shared recipe'};
    // One artwork job per tick. Old pending art is retried on subsequent ticks.
    // Never create a second task or external paid-provider call after failure.
    const pending=state.items.filter(x=>!x.isStarter&&state.artwork[discoveryIdentity(x.name)]==='pending');
    const newest=detail.result&&pending.find(x=>x.name===detail.result);
    const item=(slot%2===0?pending[pending.length-1]:newest)||pending[0];
    if(item){
      const key=discoveryIdentity(item.name);
      try{
        const kv=getPersistentCacheBinding();if(!kv)throw new Error('Artwork cache unavailable');
        const spriteKey=serverSpriteKey(item.name,false),storageKey='element-sprite-v9:'+spriteKey;
        const generated=await cachedWork<GeminiImageResult>('element-sprite-v9',spriteKey,()=>generateBloopImage(buildSpritePrompt(item.name)));
        const art=generated.value;
        if(!art?.data||art.data.length<100)throw new Error('No sprite returned');
        // cachedWork writes on misses. Never write the same KV key twice in a second.
        // If its write failed, leave the item pending and retry the cached art later.
        if(!await kv.get(storageKey,'json')){
          if(generated.cache==='miss')throw new Error('Artwork cache write not yet confirmed');
          await kv.put(storageKey,JSON.stringify(art),{expirationTtl:365*86400});
        }
        state={...state,artwork:{...state.artwork,[key]:'ready'}};
        detail={...detail,artwork:'ready'};
      }catch{detail={...detail,artwork:'pending'};}
    }
    try{state={...state,imageDay:utcBudgetDay(),imageNeuronsUsed:await getBloopImageNeuronsUsed()};}catch{/* keep last confirmed budget */}
  }catch{detail={status:'failed',message:'Craft attempt could not complete; retry next scheduled slot.'};}
  const committed=await rpc<boolean>('bloop_finish',token,{p_slot:slot,p_state:state,p_detail:detail});
  if(!committed)throw new Error('Bloop save was not committed');
  return {status:detail.status,slot,crafts:state.crafts,artwork:detail.artwork};
}
export function registerBloopRoutes(app:Express){
  app.get('/api/bloop/status',async(_req,res)=>{
    try{
      const configured=!!await credential();
      const [botUsed,sharedUsed]=await Promise.all([getBloopImageNeuronsUsed(),getImageNeuronsUsed()]);
      res.set('Cache-Control','no-store').json({name:'Bloop',isAI:true,configured,safeMode:safeImageSpendingEnabled(),cadenceMinutes:15,botUsed,botLimit:BLOOP_DAILY_IMAGE_NEURON_LIMIT,sharedUsed,sharedLimit:BOOP_DAILY_IMAGE_NEURON_LIMIT});
    }catch{res.status(503).json({error:'Bloop budget unavailable'});}
  });
  // Read only public generated cache art; no private account storage or AI calls.
  app.get('/api/bloop/art',async(req,res)=>{
    res.set('Access-Control-Allow-Origin','*');
    const name=typeof req.query.name==='string'?req.query.name.trim():'';
    if(!name||name.length>160)return res.status(400).json({error:'Invalid name'});
    try{const art=await findRecoveryArt(name,false);if(!art)return res.status(404).json({error:'Artwork pending'});
      res.set('Cache-Control','public, max-age=3600').json({imageBase64:art.data,mimeType:art.mimeType});
    }catch{res.status(503).json({error:'Artwork unavailable'});}
  });
}
