import { useCallback, useEffect, useState } from 'react';
import { cloud } from '../lib/cloudSave';
import type { BloopActivity, BloopState } from '../lib/bloop';
import type { InfiniteElement } from '../lib/infiniteCraftData';
import { discoveryIdentity } from '../lib/unifiedCollection';
import { normalizeGeneratedImage } from '../lib/elementEmoji';

type Profile={display_name:string;avatar:string;biography:string;is_ai:boolean;state:BloopState;updated_at:string};
type Activity={slot:number;created_at:string;detail:BloopActivity|{status:'started'}};
const API='https://coco-kemon.logaandavid.workers.dev';
function BloopArt({item,ready}:{item:InfiniteElement;ready:boolean}){
  const [art,setArt]=useState('');
  useEffect(()=>{setArt('');if(!ready)return;const abort=new AbortController();
    fetch(API+'/api/bloop/art?name='+encodeURIComponent(item.name),{signal:abort.signal}).then(async response=>{if(!response.ok)throw new Error('Pending');const data=await response.json();return normalizeGeneratedImage(data.imageBase64,data.mimeType);}).then(url=>{if(!abort.signal.aborted)setArt(url);}).catch(()=>{});
    return()=>abort.abort();
  },[item.name,ready]);
  return art?<img src={art} alt="" loading="lazy" style={{width:44,height:44,objectFit:'contain',imageRendering:'pixelated'}}/>:<span aria-hidden="true" style={{fontSize:26}}>{item.emoji}</span>;
}
export function BloopPanel(){
  const [profile,setProfile]=useState<Profile|null>(null),[history,setHistory]=useState<Activity[]>([]),[enabled,setEnabled]=useState<boolean|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(40),[expanded,setExpanded]=useState(false);
  const load=useCallback(async()=>{
    if(!cloud)return;
    const [p,h,c]=await Promise.all([
      cloud.from('bloop_profiles').select('display_name,avatar,biography,is_ai,state,updated_at').eq('id','bloop').maybeSingle(),
      cloud.from('bloop_activity').select('slot,created_at,detail').eq('bot_id','bloop').order('slot',{ascending:false}).limit(30),
      cloud.from('bloop_controls').select('enabled').eq('id','bloop').maybeSingle()
    ]);
    if(p.error||h.error)throw new Error('Bloop profile could not be loaded.');
    setProfile(p.data as Profile|null);setHistory((h.data||[]) as Activity[]);setEnabled(c.error?null:c.data?.enabled??null);setError('');
  },[]);
  useEffect(()=>{let active=true;const refresh=()=>{if(active)void load().catch(e=>{if(active)setError(e.message);});};refresh();const timer=setInterval(refresh,60_000);return()=>{active=false;clearInterval(timer);};},[load]);
  const toggle=async()=>{
    if(!cloud||enabled===null||busy)return;
    setBusy(true);setError('');
    try{const {data,error}=await cloud.from('bloop_controls').update({enabled:!enabled}).eq('id','bloop').select('enabled').single();if(error||!data)throw new Error('Only Bloop’s owner can change its schedule.');setEnabled(data.enabled);await load();}
    catch(e){setError(e instanceof Error?e.message:'Could not update Bloop.');}finally{setBusy(false);}
  };
  if(!profile)return error?<div className="boop-arena-panel"><h2>Bloop · AI player</h2><p>{error}</p><button onClick={()=>void load().catch(e=>setError(e.message))}>Retry</button></div>:null;
  const state=profile.state,items=state.items||[],filtered=items.filter(x=>x.name.toLowerCase().includes(query.toLowerCase()));
  const day=new Date().toISOString().slice(0,10),used=state.imageDay===day?state.imageNeuronsUsed:undefined;
  return <section className="boop-arena-panel" aria-label="Bloop autonomous AI player">
    <div className="boop-bot-head"><span className="boop-bot-avatar">{profile.avatar}</span><div><small>AI PLAYER · CURIOUS</small><h2>{profile.display_name}</h2><p>{profile.biography}</p></div></div>
    <div className="boop-bot-stats"><span><b>{1+Math.floor(state.crafts/10)}</b>Level</span><span><b>{items.length}</b>Items</span><span><b>{state.crafts}</b>Crafts</span></div>
    <p>{enabled===false?'Paused':enabled===true?'Enabled':'Autonomous collector'} · One attempt every 15 minutes · 1,000 image neurons/day within Boop’s 10,000 shared limit.</p>
    <p>{used===undefined?'Daily budget not yet reported':Math.round(used).toLocaleString()+' / 1,000 image neurons used today'} · {items.filter(x=>state.artwork?.[discoveryIdentity(x.name)]==='ready').length} sprites ready</p>
    {enabled!==null&&<button disabled={busy} onClick={()=>void toggle()}>{enabled?'Pause Bloop':'Resume Bloop'}</button>}
    <button onClick={()=>void load().catch(e=>setError(e.message))}>Refresh profile</button>
    {error&&<p role="alert">{error}</p>}
    <details open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>View collection ({items.length})</summary>
      {expanded&&<><label>Search Bloop's collection<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(40);}}/></label><div className="boop-bot-inventory">{filtered.slice(0,limit).map(item=><span key={item.id}><BloopArt item={item} ready={state.artwork?.[discoveryIdentity(item.name)]==='ready'}/>{item.name}<small>{item.rarityTier||'common'}{item.unlockedShiny?' · Shiny':''}</small></span>)}</div>{filtered.length>limit&&<button onClick={()=>setLimit(n=>n+40)}>Show more</button>}</>}
    </details>
    <details open><summary>Recent activity ({history.length})</summary><div className="boop-bot-inventory">{history.length?history.map(entry=>{const d=entry.detail;return <span key={entry.slot}><strong>{d.status==='crafted'?d.first+' + '+d.second+' → '+d.result:d.status==='started'?'Craft attempt started':d.message||d.status}</strong><small>{new Date(entry.created_at).toLocaleString()}{d.status==='crafted'?' · '+(d.isNew?'New discovery':'Duplicate')+' · '+(d.artwork||'no image request'):''}</small></span>;}):<p>No attempts yet. Bloop starts on the next scheduled run.</p>}</div></details>
  </section>;
}
