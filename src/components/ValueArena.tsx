import { useCallback, useEffect, useRef, useState } from 'react';
import { cloud } from '../lib/cloudSave';
import type { ArenaCard, ArenaView } from '../lib/arena';
export function ValueArena({ onCloud, onBack }: { onCloud:()=>void; onBack:()=>void }) {
  const [signedIn,setSignedIn]=useState(false);
  const [cards,setCards]=useState<ArenaCard[]>([]);
  const [category,setCategory]=useState('');
  const [view,setView]=useState<ArenaView|null>(null);
  const [choice,setChoice]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [now,setNow]=useState(Date.now());
  const generation=useRef(0);
  const mounted=useRef(true);
  const account=useRef<string|null>(null);
  const flight=useRef(false);
  const api=useCallback(async (action:string,body?:Record<string,unknown>)=>{
    const {data}=await cloud!.auth.getSession();
    if(!data.session)throw new Error('Sign in to play online.');
    const response=await fetch(`/api/arena/${action}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    const result=await response.json().catch(()=>{throw new Error('Arena is temporarily unavailable. Retry shortly.');});
    if(!response.ok)throw new Error(result.error||'Could not connect to the Arena.');
    return result;
  },[]);
  const load=useCallback(async()=>{
    const version=++generation.current;
    setBusy(true);setError('');
    try {const data=await api('collection');if(mounted.current&&generation.current===version){setCards(data.cards);setCategory(previous=>data.cards.some((card:ArenaCard)=>card.category===previous)?previous:data.cards[0]?.category||'');}}
    catch(error){if(mounted.current&&generation.current===version)setError(error instanceof Error?error.message:'Could not load your cloud collection.');}
    finally{if(mounted.current&&generation.current===version)setBusy(false);}
  },[api]);
  useEffect(()=>{
    mounted.current=true;
    if(!cloud)return;
    const accept=(id:string|undefined)=>{if(account.current===(id||null))return;account.current=id||null;generation.current++;setView(null);setChoice('');setCards([]);setSignedIn(!!id);if(id)void load();};
    cloud.auth.getSession().then(({data})=>{if(mounted.current)accept(data.session?.user.id);});
    const {data:{subscription}}=cloud.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED')accept(session?.user.id);});
    return()=>{mounted.current=false;generation.current++;subscription.unsubscribe();};
  },[load]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const update=useCallback(async(action:string,body:Record<string,unknown>)=>{
    if(flight.current)return;
    flight.current=true;const version=generation.current;setError('');
    try{const next=await api(action,body);if(mounted.current&&version===generation.current){setView(next);if(next.phase==='finished')setChoice('');}}
    catch(error){if(mounted.current&&version===generation.current)setError(error instanceof Error?error.message:'Connection interrupted. Retry to reconnect.');}
    finally{flight.current=false;}
  },[api]);
  useEffect(()=>{
    if(!view||view.phase==='finished')return;
    const timer=setInterval(()=>{
      if(document.visibilityState==='hidden')return;
      void update(view.phase==='waiting'?'queue':'match',view.phase==='waiting'?{category:view.category}:{room:view.room});
    },2500);
    return()=>clearInterval(timer);
  },[view?.phase,view?.room,view?.category,update]);
  const categories=[...new Set(cards.map(card=>card.category))].sort();
  const available=(view?.cards||[]).filter(card=>card.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.coins-a.coins);
  const again=async()=>{generation.current++;if(view)await api('cancel',{category:view.category});setView(null);setChoice('');setQuery('');};
  return <section className="boop-arena" aria-label="Value Arena">
    <header><div><small>PUBLIC LOBBY · 1 VS 1</small><h1>Value Arena</h1><p>Same category. Your own discoveries. Highest value wins.</p></div><button onClick={onBack}>Back to Craft</button></header>
    <p className="boop-arena-rules">Find a random online rival. A labeled bot joins after 12 seconds if no player is waiting. You have 45 seconds to lock one pick; both reveal together. No wager, no elements lost.</p>
    {!signedIn?<div className="boop-arena-panel"><h2>Bring your collection</h2><p>Sign in and save your discoveries to Cloud saves to play from any device.</p><button onClick={onCloud}>Sign in / Cloud saves</button></div>:<>
      {!view&&<div className="boop-arena-panel"><h2>Find a match</h2><p>Uses your latest cloud-saved collection. Save recent discoveries in Cloud saves before entering.</p>
        <label>Category<select value={category} onChange={event=>setCategory(event.target.value)} disabled={busy}>{categories.map(name=><option key={name}>{name}</option>)}</select></label>
        <p>{cards.filter(card=>card.category===category).length} eligible discoveries</p>
        <button disabled={busy||!category} onClick={()=>{setChoice('');void update('queue',{category});}}>Quick match</button>
        <button disabled={busy} onClick={()=>void load()}>Refresh cloud collection</button><button onClick={onCloud}>Cloud saves</button>
      </div>}
      {view?.phase==='waiting'&&<div className="boop-arena-panel" role="status"><h2>Finding your rival…</h2><p>{view.category} · {view.waiting||1} waiting</p><p>Bot joins in {Math.max(0,Math.ceil(((view.botAt||now)-now)/1000))} seconds if no player joins.</p><button onClick={()=>void again().catch(error=>setError(error.message))}>Cancel search</button></div>}
      {view&&view.phase!=='waiting'&&<div className="boop-arena-panel"><h2>{view.category}</h2><p>Opponent: {view.opponent?.name} {view.opponent?.bot?'· BOT':'· Online player'}</p>
        {view.phase==='picking'?<><p role="status">{view.locked?'Your pick is locked. Waiting for the reveal.':`${Math.max(0,Math.ceil(((view.deadline||now)-now)/1000))} seconds to choose`}</p>
          <p>{view.opponent?.locked?'Opponent locked a hidden pick.':'Opponent is choosing.'}</p>
          <label>Search eligible discoveries<input value={query} onChange={event=>setQuery(event.target.value)}/></label>
          <div className="boop-arena-cards">{available.map(card=><button key={card.key} disabled={view.locked} aria-pressed={choice===card.key} onClick={()=>setChoice(card.key)}><strong>{card.emoji} {card.name}</strong><small>{card.form} · {card.coins.toLocaleString()} Boop Coins</small></button>)}</div>
          <button disabled={!choice||view.locked} onClick={()=>void update('pick',{room:view.room,key:choice})}>Lock pick</button>
          <button onClick={()=>void api('leave',{room:view.room}).then(()=>update('match',{room:view.room})).catch(error=>setError(error.message))}>Forfeit</button>
        </>:<><h3>{view.result==='win'?'You win!':view.result==='loss'?'Your rival wins':'Draw!'}</h3><p>{view.reason}</p><div className="boop-arena-reveal">{(['you','opponent'] as const).map(side=><div key={side}><small>{side==='you'?'YOU':view.opponent?.bot?'BOT':'RIVAL'}</small><strong>{view.picks?.[side]?.name||'No pick'}</strong><b>{view.picks?.[side]?.coins.toLocaleString()||0} Boop Coins</b></div>)}</div><button onClick={()=>void again().catch(error=>setError(error.message))}>Play again</button></>}
      </div>}
    </>}
    {error&&<div role="alert" className="boop-arena-panel"><p>{error}</p><button onClick={()=>view?void update(view.phase==='waiting'?'queue':'match',view.phase==='waiting'?{category:view.category}:{room:view.room}):void load()}>Retry connection</button></div>}
  </section>;
}
