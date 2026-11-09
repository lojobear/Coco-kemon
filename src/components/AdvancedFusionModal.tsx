import React, { useMemo, useState } from 'react';
import { FlaskConical, Search, X, Sparkles, CheckCircle2 } from 'lucide-react';
import type { InfiniteElement } from '../lib/infiniteCraftData';
import { planAdvancedFusion, type FusionPlan } from '../lib/advancedFusion';
import { discoveryIdentity } from '../lib/unifiedCollection';

export function AdvancedFusionModal({
  elements,onFuse,onClose,busy=false,
}: {
  elements:readonly InfiniteElement[];
  onFuse:(plan:FusionPlan)=>void;
  onClose:()=>void;
  busy?:boolean;
}) {
  const [count,setCount]=useState<3|4>(3);
  const [slots,setSlots]=useState<string[]>(['','','','']);
  const [activeSlot,setActiveSlot]=useState<number|null>(0);
  const [query,setQuery]=useState('');
  const owned=useMemo(()=>{
    const seen=new Set<string>();
    return elements.filter(item=>{
      const id=discoveryIdentity(item.name||'');
      if(!id||seen.has(id))return false;
      seen.add(id);return true;
    }).sort((a,b)=>a.name.localeCompare(b.name));
  },[elements]);
  const byName=useMemo(()=>new Map(owned.map(item=>[discoveryIdentity(item.name),item])),[owned]);
  const selection=slots.slice(0,count);
  const ready=selection.every(Boolean);
  const plan=useMemo(()=>ready?planAdvancedFusion(selection,owned):null,[ready,selection.join('|'),owned]);
  const matches=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return (q?owned.filter(item=>item.name.toLowerCase().includes(q)):owned).slice(0,80);
  },[owned,query]);
  const select=(name:string)=>{
    if(activeSlot===null)return;
    setSlots(previous=>previous.map((item,i)=>i===activeSlot?name:item));
    const next=activeSlot+1;
    setActiveSlot(next<count?next:null);
    setQuery('');
  };
  return <div className="boop-feature-backdrop" role="presentation" onClick={onClose}>
    <section className="boop-feature-modal" role="dialog" aria-modal="true" aria-label="Advanced Fusion" onClick={event=>event.stopPropagation()}>
      <header className="boop-feature-head"><div><small>NO AI CALLS · KNOWN RECIPES ONLY</small><h2><FlaskConical size={22}/> Advanced Fusion</h2>
        <p>Combine 3 or 4 owned ingredients through Boop's shared recipe engine. Every stage uses a recipe you've learned or a built-in recipe.</p></div>
        <button type="button" aria-label="Close Advanced Fusion" onClick={onClose}><X size={19}/></button>
      </header>
      <div className="boop-feature-content">
        <div className="boop-feature-switch" role="group" aria-label="Number of fusion ingredients">
          {([3,4] as const).map(amount=><button type="button" key={amount} aria-pressed={count===amount} onClick={()=>{setCount(amount);setActiveSlot(0)}}>{amount} ingredients</button>)}
        </div>
        <div className="boop-fusion-slots">
          {selection.map((name,index)=><button type="button" key={index} aria-pressed={activeSlot===index}
            onClick={()=>{setActiveSlot(index);setQuery('')}} aria-label={`Choose advanced fusion ingredient ${index+1}`}>
            <small>ITEM {index+1}</small><strong>{byName.get(discoveryIdentity(name))?.emoji||'＋'} {name||'Choose item'}</strong>
          </button>)}
        </div>
        {activeSlot!==null&&<div className="boop-fusion-picker">
          <label><Search size={16}/><input aria-label="Search advanced fusion ingredients" placeholder="Search your collection…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
          <div className="boop-fusion-picker-list">{matches.map(item=><button type="button" key={item.id} onClick={()=>select(item.name)}><span>{item.emoji}</span>{item.name}</button>)}</div>
          <small>{matches.length} shown · repeat ingredients are allowed</small>
        </div>}
        {ready&&<div className="boop-fusion-preview">
          {plan?<><div className="boop-fusion-ready"><CheckCircle2 size={16}/> Known fusion chain found</div>
            {plan.steps.map((step,index)=><p key={index}><small>STEP {index+1}</small> {step.first} + {step.second} <b>→ {step.emoji} {step.result}</b></p>)}
            <strong className="boop-fusion-final">Final: {plan.emoji} {plan.result}</strong></>
          :<p role="status">No fully known chain for these ingredients yet. Discover more two-item recipes first; Advanced Fusion never spends AI credits guessing.</p>}
        </div>}
        <button type="button" className="boop-feature-primary" disabled={!plan||busy} onClick={()=>{if(plan){onFuse(plan);onClose()}}}>
          <Sparkles size={17}/>{busy?'Crafting…':plan?`Fuse ${count} items`:'Choose a valid known chain'}
        </button>
        <p className="boop-feature-note">Successful stages record normal crafting history, rarity rolls and discoveries in your existing collection. No separate save or paid AI calls.</p>
      </div>
    </section>
  </div>;
}
