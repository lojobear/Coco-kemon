import { useEffect, useRef } from 'react';
import { Sparkles, X, BookOpen, ArrowRight } from 'lucide-react';
import { useGame } from '../lib/gameStore';
import { materialArtwork } from '../lib/discoveryArtwork';

export function DiscoveryModal() {
  const { recentDiscovery, closeDiscoveryModal, setActiveTab, setInspectedItem, setSlotA, setSlotB } = useGame();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (recentDiscovery && !dialog.current?.open) dialog.current?.showModal();
    if (!recentDiscovery) dialog.current?.close();
  }, [recentDiscovery]);
  const material = recentDiscovery?.material;
  const oddkin = recentDiscovery?.oddkin;
  const name = oddkin?.speciesName || material?.displayName;
  return <dialog ref={dialog} className="collection-reveal" aria-labelledby="discovery-title" onCancel={e => { e.preventDefault(); closeDiscoveryModal(); }}>
    {recentDiscovery && <>
      <button className="reveal-close" aria-label="Close discovery" onClick={closeDiscoveryModal}><X size={22} /></button>
      <p className="reveal-eyebrow"><Sparkles size={16} />{oddkin ? 'Meet your Oddkin' : recentDiscovery.isNew ? 'New discovery' : 'Discovered again'}</p>
      <h2 id="discovery-title">{name}</h2><p className="reveal-category">{oddkin?.titleOrClassification || material?.category}{recentDiscovery.isChroma ? ' · Chroma form' : ''}</p>
      <img className={`reveal-art pixelated ${recentDiscovery.isNew ? 'reveal-new' : ''}`} src={oddkin?.customSpriteUrl || (material ? materialArtwork(material) : undefined)} alt={name} />
      <p className="reveal-explanation">{recentDiscovery.explanation}</p>
      {oddkin?.lineage && <details className="reveal-lineage"><summary>How this Oddkin came to life</summary>{oddkin.lineage.fullAncestryChain.map((step, i) => <p key={i}>{step.inputs.join(' + ')} → {step.result} ({step.process})</p>)}</details>}
      {material && <button className="combine-primary" onClick={() => { setSlotA(material); setSlotB(null); setActiveTab('foundry'); closeDiscoveryModal(); }}>Use in next combination <ArrowRight size={19} /></button>}
      <div className="reveal-actions"><button onClick={() => { closeDiscoveryModal(); setActiveTab('archive'); if (oddkin) setInspectedItem({type:'oddkin',item:oddkin}); else if (material) setInspectedItem({type:'material',item:material}); }}><BookOpen size={17} /> View details</button><button onClick={closeDiscoveryModal}>Keep exploring</button></div>
    </>}
  </dialog>;
}
