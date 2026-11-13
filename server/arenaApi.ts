import type { DurableObjectNamespace, DurableObjectState } from '@cloudflare/workers-types/index.ts';
import { createClient } from '@supabase/supabase-js';
import type { ArenaPlayer } from '../src/lib/arena';
import { arenaCards } from '../src/lib/arena';
import { validateCraft } from '../src/lib/saveData';
import { BoopArena } from './arenaObjects';
import { BOT_REGISTRY, botDefinition } from '../src/lib/botCollectors';
const SUPABASE_URL='https://lrjszbguvqgdsqvvcoqe.supabase.co';
const KEY='sb_publishable_y7dGWisvgKzLvRVpbzd0zw_BISm05fI';
const auth=createClient(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15_000)})}});
export interface ArenaEnv { BOOP_ARENA: DurableObjectNamespace<BoopArena> }
async function smallBody(request: Request): Promise<Record<string,unknown>> {
  if(!request.body)return {};
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new Error('Arena request is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const data=JSON.parse(new TextDecoder().decode(bytes)||'{}');
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid Arena request.');
  return data;
}
export async function arenaFetch(request: Request, env: ArenaEnv): Promise<Response> {
  try {
    const url=new URL(request.url);
    if (!['GET','POST'].includes(request.method)) return Response.json({error:'Method not allowed.'},{status:405});
    if (!env.BOOP_ARENA) return Response.json({error:'Online Arena is not available on this server.'},{status:503});
    const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!token || token.length>8000) return Response.json({error:'Sign in to enter the public lobby.'},{status:401});
    const {data,error}=await auth.auth.getUser(token);
    if (error || !data.user) return Response.json({error:'Your sign-in expired. Sign in again.'},{status:401});
    const user=data.user.id;
    const body=request.method==='POST'?await smallBody(request):{};
    const action=url.pathname.split('/').pop();
    if((['collection','bots'].includes(action||'')&&request.method!=='GET')||(!['collection','bots'].includes(action||'')&&request.method!=='POST'))return Response.json({error:'Method not allowed.'},{status:405});
    if(action==='bots')return Response.json({profiles:await env.BOOP_ARENA.getByName(BOT_REGISTRY).botProfiles()},{headers:{'Cache-Control':'no-store'}});
    if (['pick','match','leave'].includes(action||'')) {
      const room=String(body.room||url.searchParams.get('room')||'');
      if (!/^match:[a-f0-9-]{36}$/.test(room)) throw new Error('Invalid match.');
      const stub=env.BOOP_ARENA.getByName(room);
      if (action==='leave') { await stub.forfeit(user);return Response.json({ok:true}); }
      const view=action==='pick'?await stub.pick(user,String(body.key||'').slice(0,200)):await stub.view(user);
      return Response.json({...view,room},{headers:{'Cache-Control':'no-store'}});
    }
    if (!['queue','collection','cancel','challenge'].includes(action||'')) return Response.json({error:'Arena route not found.'},{status:404});
    const requestedCategory=String(body.category||'').slice(0,60);
    if(action!=='collection' && !requestedCategory)throw new Error('Choose a category.');
    const lobby=action==='collection'?null:env.BOOP_ARENA.getByName(`queue:${requestedCategory}`);
    if(action==='cancel')return Response.json(await lobby!.queue({id:user,name:'',bot:false,cards:[]},requestedCategory,true));
    if(action==='queue'){
      const resumed=await lobby!.resume(user,requestedCategory);
      if(resumed)return Response.json(resumed,{headers:{'Cache-Control':'no-store'}});
    }
    const response=await fetch(`${SUPABASE_URL}/rest/v1/game_saves?user_id=eq.${encodeURIComponent(user)}&select=payload&limit=1`,{headers:{apikey:KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15_000)});
    if (!response.ok) throw new Error('Could not read your cloud collection. Try again.');
    const rows=await response.json() as {payload:{crafting:unknown}}[];
    const crafting=rows[0]?.payload?.crafting;
    if (!validateCraft(crafting)) throw new Error('Save your collection to Cloud saves before playing online.');
    const cards=arenaCards(crafting);
    if (action==='collection') return Response.json({cards},{headers:{'Cache-Control':'no-store'}});
    const category=requestedCategory;
    const eligible=cards.filter(card=>card.category===category).sort((a,b)=>b.coins-a.coins);
    if (!eligible.length) throw new Error('No cloud-saved elements in that category. Save your latest progress first.');
    const player: ArenaPlayer={id:user,name:`Player ${user.slice(0,4).toUpperCase()}`,bot:false,cards:eligible.slice(0,500)};
    let opponent:ArenaPlayer|undefined;
    if(action==='challenge'){
      const id=String(body.botId||'');
      if(!botDefinition(id))throw new Error('Choose a known bot collector.');
      const bot=await env.BOOP_ARENA.getByName(BOT_REGISTRY).selectBot(category,id);
      if(!bot)throw new Error('This collector does not own an element in your selected category.');
      opponent=bot;
    }
    return Response.json(await env.BOOP_ARENA.getByName(`queue:${category}`).queue(player,category,false,opponent),{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return Response.json({error:error instanceof Error?error.message.slice(0,240):'Arena connection failed. Try again.'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
