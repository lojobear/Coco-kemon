import { useEffect, useRef } from 'react';
import { Sparkles, X, BookOpen, ArrowRight, FlaskConical } from 'lucide-react';
import { useGame } from '../lib/gameStore';
import { MaterialSprite } from './ElementSprite';

export function DiscoveryModal() {
  const { recentDiscovery, closeDiscoveryModal, setActiveTab, setInspectedItem, setSlotA, setSlotB, progression } = useGame();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (recentDiscovery && !dialog.current?.open) dialog.current?.showModal();
    if (!recentDiscovery) dialog.current?.close();
  }, [recentDiscovery]);
  const material = recentDiscovery?.material;
  const oddkin = recentDiscovery?.oddkin;
  const hasDiscovery = Boolean(material || oddkin);
  const name = oddkin?.speciesName || material?.displayName || 'No reaction this time';
  return <dialog ref={dialog} className="collection-reveal" aria-labelledby="discovery-title" onCancel={e => { e.preventDefault(); closeDiscoveryModal(); }}>
    {recentDiscovery && <>
      <button className="reveal-close" aria-label="Close discovery" onClick={closeDiscoveryModal}><X size={22} /></button>
      <p className="reveal-eyebrow"><Sparkles size={16} />{!hasDiscovery ? 'Experiment recorded' : oddkin ? 'Meet your Oddkin' : recentDiscovery.isNew ? 'New discovery' : 'Discovered again'}</p>
      <h2 id="discovery-title">{name}</h2><p className="reveal-category">{oddkin?.titleOrClassification || material?.category}{recentDiscovery.isChroma ? ' · Chroma form' : ''}{recentDiscovery.variant ? ` · ${recentDiscovery.variant} variant` : ''}</p>
      {recentDiscovery.variant && <div className={`reveal-variant variant-${recentDiscovery.variant}`}><Sparkles size={14} /> RARE VARIANT · {recentDiscovery.variant.toUpperCase()}</div>}
      {hasDiscovery ? (material ? <MaterialSprite material={material} className="reveal-art" alt={name} /> : <img className="reveal-art pixelated" src={oddkin?.customSpriteUrl} alt={name} />) : <div className="reveal-no-reaction" aria-hidden="true"><FlaskConical size={52} /></div>}
      <p className="reveal-explanation">{recentDiscovery.explanation}</p>
      {recentDiscovery.isNew && hasDiscovery && <div className="reveal-progression">
        <span>🔥 Discovery streak <b>{progression.streak}</b></span>
        <span>🏆 Level <b>{progression.level}</b></span>
        <span>✨ {progression.xp} XP</span>
        {recentDiscovery.xpBonus ? <span className="reveal-xp-bonus">+{recentDiscovery.xpBonus} streak bonus</span> : null}
      </div>}
      {oddkin?.lineage && <details className="reveal-lineage"><summary>How this Oddkin came to life</summary>{oddkin.lineage.fullAncestryChain.map((step, i) => <p key={i}>{step.inputs.join(' + ')} → {step.result} ({step.process})</p>)}</details>}
      {material && <button className="combine-primary" onClick={() => { setSlotA(material); setSlotB(null); setActiveTab('foundry'); closeDiscoveryModal(); }}>Use in next combination <ArrowRight size={19} /></button>}
      <div className="reveal-actions">{hasDiscovery && <button onClick={() => { closeDiscoveryModal(); setActiveTab('archive'); if (oddkin) setInspectedItem({type:'oddkin',item:oddkin}); else if (material) setInspectedItem({type:'material',item:material}); }}><BookOpen size={17} /> View details</button>}<button onClick={closeDiscoveryModal}>{hasDiscovery ? 'Keep exploring' : 'Try another combination'}</button></div>
    </>}
  </dialog>;
}

