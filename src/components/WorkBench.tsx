import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Hammer, Search, Plus, X, Dice5, Sparkles, Info, Shuffle, ArrowLeftRight, RotateCcw, Trophy, Target, Layers3, Flame, SlidersHorizontal, ChevronUp, ChevronDown, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useGame } from '../lib/gameStore';
import type { Material } from '../types';
import { readCraftElements, SAVE_IMPORTED_EVENT } from '../lib/saveData';
import { conceptMaterial } from '../lib/conceptMaterial';
import { MaterialSprite } from './ElementSprite';
import { chooseRandomProcess } from '../lib/randomProcess';
import { EXTRA_PROCESSES } from '../lib/extraProcesses';
import { FOUNDRY_ACTIONS } from '../lib/foundryActions';
import { sound } from '../lib/audio';
import { FoundryFusionOverlay } from './FoundryFusionOverlay';

export function WorkBench({ onInspectMaterial }: { onInspectMaterial: (m: Material) => void }) {
  const { materials: foundryMaterials, processes, slotA, slotB, selectedProcess, setSlotA, setSlotB,
    setSelectedProcess, runSynthesis, isSynthesizing, synthesisStage, setActiveTab, clearSlots, progression } = useGame();
  const [craftItems, setCraftItems] = useState(readCraftElements);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'collection' | 'recent' | 'name'>('collection');
  const [visibleCount, setVisibleCount] = useState(48);
  useEffect(()=>setVisibleCount(48),[search,category,sort]);
  const [picker, setPicker] = useState<'A' | 'B' | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const openInventory = (slot?: 'A' | 'B') => {
    if (slot) setPicker(slot);
    setInventoryOpen(true);
  };
  const closeInventory = () => { setInventoryOpen(false); setPicker(null); };
  useEffect(() => {
    if (!inventoryOpen) return;
    const onKey = (event: KeyboardEvent) => { if(event.key === 'Escape')closeInventory(); };
    const onBack = () => closeInventory();
    window.addEventListener('keydown', onKey);
    window.addEventListener('boop-native-back', onBack);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('boop-native-back', onBack); };
  }, [inventoryOpen]);
  // Keep the Pixel 9 keyboard closed when the ingredient sheet opens:
  // players can browse pixel sprites first and tap Search if they want to type.
  useEffect(() => {
    const reload = () => setCraftItems(readCraftElements());
    window.addEventListener(SAVE_IMPORTED_EVENT, reload);
    return () => window.removeEventListener(SAVE_IMPORTED_EVENT, reload);
  }, []);
  const materials = useMemo(() => {
    const names = new Set(foundryMaterials.map(item => item.displayName.trim().toLowerCase()));
    return [...foundryMaterials, ...craftItems.filter(item => !names.has(item.name.trim().toLowerCase())).map(item => {
      const material = conceptMaterial({ result: item.name, emoji: item.emoji, explanation: item.explanation, connection: item.connection });
      return { ...material, discoveredAt: item.discoveredAt || 0, customSpriteUrl: item.customSpriteUrl };
    })];
  }, [foundryMaterials, craftItems]);
  const availableProcesses = useMemo(() => [...processes, ...EXTRA_PROCESSES.filter(extra => !processes.some(p => p.id === extra.id)), ...FOUNDRY_ACTIONS.filter(action => ![...processes, ...EXTRA_PROCESSES].some(p => p.id === action.id))].filter(p => p.unlocked), [processes]);
  // Mix is the useful default; all unlocked transformations remain available.
  const process = selectedProcess || availableProcesses.find(p => p.id === 'MIX') || availableProcesses[0];
  const categories = useMemo(() => [...new Set<string>(materials.map(m => m.category))].sort((a,b) => a.localeCompare(b)), [materials]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = materials.filter(m => (category === 'all' || m.category === category) && `${m.displayName} ${m.category} ${m.semanticTags.join(' ')}`.toLowerCase().includes(query));
    if (sort === 'recent') result.sort((a,b) => b.discoveredAt - a.discoveredAt);
    if (sort === 'name') result.sort((a,b) => a.displayName.localeCompare(b.displayName));
    return result;
  }, [materials, category, search, sort]);
  const selectItem = (item: Material) => {
    if (isSynthesizing) return;
    sound.playClick();
    if (picker === 'A') setSlotA(item);
    else if (picker === 'B') setSlotB(item);
    else if (!slotA) setSlotA(item);
    else if (!slotB) setSlotB(item);
    else if (slotA.id === item.id) setSlotA(null);
    else if (slotB.id === item.id) setSlotB(null);
    else setSlotB(item);
    setPicker(null);
    setInventoryOpen(false);
  };
  const chooseSlot = (slot: 'A' | 'B') => openInventory(slot);
  const randomItems = () => {
    if (isSynthesizing || !materials.length) return;
    const first = Math.floor(Math.random() * materials.length);
    const others = materials.filter((_, i) => i !== first);
    setSlotA(materials[first]);
    setSlotB(others.length ? others[Math.floor(Math.random() * others.length)] : materials[first]);
    setPicker(null);
    sound.playClick();
  };
  // Synchronize the displayed default with the existing synthesis state.
  useEffect(() => { if (!selectedProcess && process && !isSynthesizing) setSelectedProcess(process); }, [selectedProcess, process, isSynthesizing, setSelectedProcess]);

  return <section className="collection-workbench" aria-label="Foundry workspace"><FoundryFusionOverlay />
    <div className="workbench-intro boop-focus-intro">
      <div><h1>Combine</h1><p>Two discoveries. One surprise.</p></div>
      <button type="button" className="boop-workbench-craft-link" onClick={() => setActiveTab('infinite-craft')}><Hammer size={16}/> Craft board</button>
    </div>
    <div className={`combine-dock boop-focus-recipe ${isSynthesizing ? 'is-combining' : ''}`}>
      <div className="boop-pad-heading"><span>INGREDIENTS</span><span className="boop-ready-tag">{slotA && slotB ? <><CheckCircle2 size={12}/> Ready</> : `${Number(!!slotA)+Number(!!slotB)} of 2 selected`}</span></div>
      <div className="combine-inputs">
        {(['A', 'B'] as const).map((key, index) => {
          const item = key === 'A' ? slotA : slotB;
          return <React.Fragment key={key}>{index === 1 && <Plus className="ingredient-plus" size={20} />}
            <div className="ingredient">
              <button className={`ingredient-pick ${picker === key ? 'is-targeted' : ''}`} aria-label={`Choose item ${key}${item ? `: ${item.displayName}` : ''}`} disabled={isSynthesizing} onClick={() => chooseSlot(key)}>
                {item ? <MaterialSprite material={item} className="ingredient-emoji" /> : <Plus size={24} />}
              </button>
              {item && <button className="ingredient-remove" aria-label={`Remove item ${key}`} disabled={isSynthesizing} onClick={() => key === 'A' ? setSlotA(null) : setSlotB(null)}><X size={15} /></button>}
              <span>{item?.displayName || (key === 'A' ? 'Ingredient one' : 'Ingredient two')}</span>
            </div>
          </React.Fragment>;
        })}
      </div>
      <div className="combine-actions"><button className="combine-primary" disabled={!slotA || !slotB || !selectedProcess || isSynthesizing} onClick={() => void runSynthesis()}><Sparkles size={20} />{isSynthesizing ? 'Combining…' : 'Discover result'}</button></div>
      {isSynthesizing && <p className="synthesis-status" role="status">{synthesisStage || 'Discovering something new…'}</p>}
      <details className="boop-combine-settings">
        <summary><SlidersHorizontal size={16}/><span>More options</span><b>{process?.name || 'Mix'}</b></summary>
      <div className="recipe-tools"><span>{slotA ? `${slotA.displayName}${slotB ? ` + ${slotB.displayName}` : ''}` : 'Pick an item to begin'}</span><button disabled={isSynthesizing || !slotA || !slotB} aria-label="Swap ingredients" onClick={() => { setSlotA(slotB); setSlotB(slotA); }}><ArrowLeftRight size={16} /></button><button disabled={isSynthesizing || (!slotA && !slotB)} aria-label="Clear ingredients" onClick={() => { clearSlots(); setPicker(null); }}><RotateCcw size={16} /></button></div>
        <div className="process-control"><label htmlFor="foundry-process">Process</label>
          <select id="foundry-process" value={process?.id || ''} disabled={isSynthesizing} onChange={e => setSelectedProcess(availableProcesses.find(p => p.id === e.target.value) || null)}>
            {availableProcesses.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
          </select>
          <button className="random-process" type="button" disabled={isSynthesizing || !availableProcesses.length} onClick={() => setSelectedProcess(chooseRandomProcess(availableProcesses, process?.id))}><Shuffle size={16}/> Random process</button>
        </div>
        <button type="button" className="boop-focus-surprise" aria-label="Choose two random ingredients" disabled={isSynthesizing || !materials.length} onClick={randomItems}><Dice5 size={17}/> Surprise me with two ingredients</button>
      </details>

    </div>
    <button type="button" className="boop-combine-browse-toggle" aria-expanded={inventoryOpen} aria-controls="boop-combine-inventory" onClick={()=>inventoryOpen?closeInventory():openInventory()}>
      <span><Search size={18}/><strong>Choose ingredients</strong><small>{materials.length} collected</small></span>
      {inventoryOpen?<ChevronDown size={18}/>:<ChevronUp size={18}/>}
    </button>
    {inventoryOpen && <button type="button" className="boop-combine-backdrop" aria-label="Close ingredient picker" onClick={closeInventory}/>}
    <div id="boop-combine-inventory" className={`boop-combine-inventory ${inventoryOpen?'is-open':''}`}>
    <div className="boop-combine-inventory-handle" aria-hidden="true"/>
    <div className="boop-combine-inventory-title"><div><strong>Pick a discovery</strong><small>{picker ? `Filling ingredient ${picker}` : 'Tap any sprite to fill the next slot'}</small></div><button aria-label="Close ingredient picker" onClick={closeInventory}><X size={19}/></button></div>
    {!search && category==='all' && <div className="boop-combine-quick boop-combine-quick--in-picker">
      <div className="boop-combine-quick-heading"><span>RECENT DISCOVERIES</span><small>Quick add</small></div>
      <div className="boop-combine-quick-row">
        {[...materials].sort((a,b)=>b.discoveredAt-a.discoveredAt).slice(0,7).map(item=>
          <button type="button" key={item.id} disabled={isSynthesizing} onClick={()=>selectItem(item)} aria-label={`Quick pick ${item.displayName}`}>
            <MaterialSprite material={item}/><span>{item.displayName}</span>
          </button>
        )}
      </div>
    </div>}
    <div className="discovery-heading"><h2>Ingredients <span>{materials.length}</span></h2>
      <label className="discovery-search"><Search size={17} /><input ref={searchRef} aria-label="Search your discoveries" placeholder="Find a sprite…" value={search} onChange={e => setSearch(e.target.value)} /></label>
    </div>
    {picker && <div className="picker-prompt" role="status">Choose item {picker}. You can use the same item twice.<button onClick={() => setPicker(null)} aria-label="Cancel choosing item"><X size={16} /></button></div>}
    <details className="boop-discovery-filters">
      <summary><SlidersHorizontal size={15}/> Filter & sort <span>{filtered.length} items</span></summary>
      <div className="collection-filters">
        <label><span className="sr-only">Discovery category</span><select aria-label="Discovery category" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label><span className="sr-only">Sort discoveries</span><select aria-label="Sort discoveries" value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="collection">Collection order</option><option value="recent">Newest first</option><option value="name">Name A–Z</option></select></label>
      </div>
    </details>
    <div className="discovery-grid" aria-label="Discovered items" aria-busy={isSynthesizing}>
      {filtered.slice(0,visibleCount).map(item => <div key={item.id} data-rarity={item.rarity} className={`discovery-tile ${item.variant ? `variant-${item.variant}` : ''} ${slotA?.id === item.id || slotB?.id === item.id ? 'is-selected' : ''}`}>
        <button className="discovery-pick" onClick={() => selectItem(item)} disabled={isSynthesizing} aria-label={`Select ${item.displayName}`} aria-pressed={slotA?.id === item.id || slotB?.id === item.id}>
          <MaterialSprite material={item} className="discovery-emoji" /><span>{item.displayName}</span>
        </button>
        {(slotA?.id === item.id || slotB?.id === item.id) && <span className="ingredient-badge">{[slotA?.id === item.id ? 'A' : '', slotB?.id === item.id ? 'B' : ''].filter(Boolean).join(' + ')}</span>}
        {item.variant && <span className={`variant-badge variant-${item.variant}`}>{item.variant}</span>}
        <button className="discovery-info" aria-label={`Details for ${item.displayName}`} onClick={() => { onInspectMaterial(item); setActiveTab('archive'); }}><Info size={15} /></button>
      </div>)}
      {!filtered.length && <p className="collection-empty">No discoveries match these filters. <button onClick={() => { setSearch(''); setCategory('all'); }}>Clear filters</button></p>}
    </div>
    {visibleCount<filtered.length && <button className="boop-more-discoveries" onClick={()=>setVisibleCount(n=>n+48)}>Show more discoveries <span>{Math.min(visibleCount,filtered.length)} of {filtered.length}</span></button>}
    </div>
    <details className="boop-foundry-progress-details">
      <summary><Trophy size={15}/> Collection progress <span>Level {progression.level} · {progression.xp} XP</span></summary>
    <div className="progression-loop" aria-label="Discovery progression">
      <div className="progression-level">
        <span className="progression-icon"><Trophy size={16} /></span>
        <div><strong>Level {progression.level}</strong><small>{progression.xp} XP</small></div>
        <div className="progression-xp"><span style={{ width: `${Math.min(100, (progression.levelCurrent / progression.levelRequired) * 100)}%` }} /></div>
      </div>
      <div className="progression-chips">
        <span><Flame size={14} /><b>{progression.streak}</b> streak <small>next {progression.nextStreakMilestone}</small></span>
        <span><Layers3 size={14} /><b>{progression.sets.filter(s => s.complete).length}/{progression.sets.length}</b> sets</span>
        <span><Target size={14} /><b>{progression.dailyGoals.filter(g => g.progress >= g.target).length}/{progression.dailyGoals.length}</b> daily</span>
      </div>
      <div className="progression-details">
        <div className="progression-set-row">{progression.sets.map(set => <span key={set.id} title={set.hint} className={set.complete ? 'complete' : ''}>{set.name} {Math.min(set.count, set.target)}/{set.target}</span>)}</div>
        <div className="progression-goals">{progression.dailyGoals.map(goal => <span key={goal.id} className={goal.progress >= goal.target ? 'complete' : ''}>{goal.label} <b>{goal.progress}/{goal.target}</b></span>)}</div>
        {progression.hint && <p className="progression-hint"><Sparkles size={13} /> {progression.hint}</p>}
      </div>
    </div>
    </details>

  </section>;
}

