import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, Sparkles, GalleryVerticalEnd, LayoutGrid, ChevronRight, ArrowLeft, X, Lock, Plus, Trash2, Share2, Check, Star, GitBranch, Trophy, Shuffle } from 'lucide-react';
import type { InfiniteElement } from '../lib/infiniteCraftData';
import { useGame } from '../lib/gameStore';
import { readCraftElements, readCollectorRoom, saveCollectorRoom, SAVE_CHANGED_EVENT, SAVE_IMPORTED_EVENT } from '../lib/saveData';
import { ALBUM_SETS, albumSetProgress, availableVariants, evolutionFor, type CollectorVariant, type FrameStyle, type TrophyRoom, type RoomTheme, SHINY_ODDS, CELESTIAL_ODDS } from '../lib/collectorData';
import { normalizeElementStats } from '../lib/elementStats';
import { CraftSprite, CraftSprites } from './CraftSprite';
import { exportTrophyPostcard } from '../lib/trophyPostcard';
import type { Material, Oddkin } from '../types';

const LegacyArchive = lazy(() => import('./ArchiveView').then(m=>({default:m.ArchiveView})));
type AlbumTab = 'album'|'sets'|'room'|'foundry';
type AlbumFilter = 'all'|'shiny'|'celestial'|'evolved';

function CollectibleArt({ item, variant = 'normal' }: {item: InfiniteElement; variant?: CollectorVariant}) {
  return <span className={`boop-album-art boop-album-art--${variant} boop-album-art--evolution-${evolutionFor(item).level}`}>
    <CraftSprite name={item.name} emoji={item.emoji} isShiny={variant==='shiny'} idle={false}/>
    {variant!=='normal' && <i aria-hidden="true">{variant==='celestial'?'✶':'✦'}</i>}
  </span>;
}
function CollectorCard({item,index,onOpen}: {item:InfiniteElement;index:number;onOpen:()=>void}) {
  const evo=evolutionFor(item);
  const variant:CollectorVariant=item.unlockedCelestial?'celestial':availableVariants(item).includes('shiny')?'shiny':'normal';
  return <button className={`boop-sticker-card is-${variant}`} type="button" onClick={onOpen} aria-label={`Inspect collectible ${item.name}`}>
    <span className="boop-sticker-index">#{String(index+1).padStart(3,'0')}</span>
    <CollectibleArt item={item} variant={variant}/>
    <span className="boop-sticker-name">{item.name}</span>
    <span className="boop-sticker-footer"><small>{evo.tier.marker} {evo.tier.name}</small>{variant==='celestial'?<b>CELESTIAL</b>:variant==='shiny'?<b>SHINY</b>:null}</span>
  </button>;
}
export function CollectionAlbum({
  initialSearch='', inspectedItem, onCloseInspect,
}:{
  initialSearch?:string;
  inspectedItem:{type:'material'|'oddkin';item:Material|Oddkin}|null;
  onCloseInspect:()=>void;
}) {
  const [elements,setElements]=useState<InfiniteElement[]>(readCraftElements);
  const [room,setRoom]=useState<TrophyRoom>(readCollectorRoom);
  const [tab,setTab]=useState<AlbumTab>('album');
  const [query,setQuery]=useState(initialSearch);
  const [filter,setFilter]=useState<AlbumFilter>('all');
  const [sort,setSort]=useState<'recent'|'az'|'crafted'>('recent');
  const [visible,setVisible]=useState(72);
  const [selected,setSelected]=useState<InfiniteElement|null>(null);
  const [viewVariant,setViewVariant]=useState<CollectorVariant>('normal');
  const [slotPicker,setSlotPicker]=useState<number|null>(null);
  const [pickerSearch,setPickerSearch]=useState('');
  const [frame,setFrame]=useState<FrameStyle>('classic');
  const [galleryNotice,setGalleryNotice]=useState('');
  const [exporting,setExporting]=useState(false);
  const {setActiveTab}=useGame();

  useEffect(()=>setQuery(initialSearch),[initialSearch]);
  useEffect(()=>{
    const refresh=()=>{setElements([...readCraftElements()]);setRoom(readCollectorRoom());};
    window.addEventListener(SAVE_CHANGED_EVENT,refresh);
    window.addEventListener(SAVE_IMPORTED_EVENT,refresh);
    return()=>{window.removeEventListener(SAVE_CHANGED_EVENT,refresh);window.removeEventListener(SAVE_IMPORTED_EVENT,refresh);};
  },[]);
  useEffect(()=>{
    const open=()=>{setTab('room');setSlotPicker(null);};
    window.addEventListener('boop-open-trophy-room',open);
    return()=>window.removeEventListener('boop-open-trophy-room',open);
  },[]);
  const catalog=useMemo<InfiniteElement[]>(()=>{
    const seen=new Set<string>();
    return elements.filter(el=>{
      const key=el?.name?.trim().toLowerCase();
      if(!key||seen.has(key))return false;
      seen.add(key);return true;
    }).map(normalizeElementStats);
  },[elements]);
  const byName=useMemo(()=>new Map<string,InfiniteElement>(catalog.map(e=>[e.name.trim().toLowerCase(),e] as [string,InfiniteElement])),[catalog]);
  const custom=useMemo(()=>new Map(catalog.flatMap(e=>e.customSpriteUrl
    ? [[e.name.toLowerCase(),e.customSpriteUrl] as const]:[])),[catalog]);
  const shown=useMemo<InfiniteElement[]>(()=>{
    const q=query.toLowerCase().trim();
    const list=catalog.filter(e=>(!q||e.name.toLowerCase().includes(q)||
      e.connection?.toLowerCase().includes(q)) && (filter==='all'||
      (filter==='shiny'&&availableVariants(e).includes('shiny'))||
      (filter==='celestial'&&Boolean(e.unlockedCelestial))||
      (filter==='evolved'&&evolutionFor(e).level>0)));
    if(sort==='az')list.sort((a,b)=>a.name.localeCompare(b.name));
    else if(sort==='crafted')list.sort((a,b)=>(b.craftCount||0)-(a.craftCount||0));
    else list.sort((a,b)=>(b.discoveredAt||0)-(a.discoveredAt||0));
    return list;
  },[catalog,query,sort,filter]);
  useEffect(()=>setVisible(72),[query,sort,filter]);
  const shinyCount=catalog.filter(e=>availableVariants(e).includes('shiny')).length;
  const celestialCount=catalog.filter(e=>Boolean(e.unlockedCelestial)).length;
  const evolvedCount=catalog.filter(e=>evolutionFor(e).level>0).length;

  const openItem=(item:InfiniteElement)=>{
    setSelected(item);
    setViewVariant(item.unlockedCelestial?'celestial':availableVariants(item).includes('shiny')?'shiny':'normal');
  };
  const persistRoom=(next:TrophyRoom)=>{
    const available=new Map<string,InfiniteElement>(catalog.map(e=>[e.name.toLowerCase(),e] as [string,InfiniteElement]));
    const safe={...next,slots:next.slots.map(slot=>{
      if(!slot)return null;
      const found=available.get(slot.name.toLowerCase());
      return found&&availableVariants(found).includes(slot.variant)?slot:null;
    })};
    setRoom(safe);saveCollectorRoom(safe);
  };
  const chooseSlot=(index:number)=>{
    const current=room.slots[index];
    setFrame(current?.frame||'classic');
    setViewVariant(current?.variant||'normal');
    setPickerSearch('');
    setSlotPicker(index);
  };
  const assign=(item:InfiniteElement,variant:CollectorVariant)=>{
    if(slotPicker===null)return;
    if(!availableVariants(item).includes(variant))return;
    const next=[...room.slots];
    next[slotPicker]={name:item.name,variant,frame};
    persistRoom({...room,slots:next});
    setSlotPicker(null);
  };
  const moveSlot=(from:number,to:number)=>{
    if(!Number.isInteger(from)||from<0||from>=room.slots.length||to<0||to>=room.slots.length)return;
    const next=[...room.slots];[next[from],next[to]]=[next[to],next[from]];
    persistRoom({...room,slots:next});
  };
  const shareRoom=async()=>{
    setExporting(true);setGalleryNotice('');
    try{
      const blob=await exportTrophyPostcard(room,catalog);
      const file=new File([blob],'boop-trophy-room.png',{type:'image/png'});
      if(navigator.canShare?.({files:[file]})&&navigator.share){
        await navigator.share({title:'My Boop trophy room',files:[file]});
        setGalleryNotice('Trophy room ready to share.');
      }else{
        const url=URL.createObjectURL(blob);
        const anchor=document.createElement('a');anchor.href=url;anchor.download='boop-trophy-room.png';document.body.appendChild(anchor);anchor.click();anchor.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30_000);
        setGalleryNotice('Trophy room PNG created. Share the image with friends.');
      }
    }catch(error){
      setGalleryNotice(error instanceof Error&&error.name==='AbortError'?'Sharing cancelled.':'Could not create the image on this device.');
    }finally{setExporting(false);}
  };
  const latestRecipes=(item:InfiniteElement)=>normalizeElementStats(item).recipeHistory||[];
  const descendants=(item:InfiniteElement)=>catalog.filter(e=>
    (e.recipeHistory||[]).some(r=>[r.first,r.second].some(n=>n.trim().toLowerCase()===item.name.trim().toLowerCase()))).slice(0,12);

  return <CraftSprites.Provider value={custom}>
    <section className="boop-album-page">
      <header className="boop-album-header">
        <div className="boop-album-title"><span className="boop-album-mark"><BookOpen size={23}/></span>
          <div><small>YOUR PERSONAL COLLECTION</small><h1>Collection.</h1><p>A little museum of everything you've discovered.</p></div>
        </div>
        <button type="button" className="boop-album-outline-button" onClick={()=>setActiveTab('infinite-craft')}><Plus size={16}/> Discover more</button>
      </header>
      <div className="boop-album-summary" aria-label="Collection statistics">
        <div><strong>{catalog.length.toLocaleString()}</strong><small>Collected</small></div>
        <div><strong>{shinyCount}</strong><small>Shiny forms</small></div>
        <div><strong>{celestialCount}</strong><small>Celestial</small></div>
        <div><strong>{evolvedCount}</strong><small>Evolved</small></div>
      </div>
      <nav className="boop-album-tabs" aria-label="Collection views">
        {([{id:'album',label:'Sticker album',icon:LayoutGrid},{id:'sets',label:'Themed sets',icon:Sparkles},
          {id:'room',label:'Trophy room',icon:Trophy},{id:'foundry',label:'Foundry archive',icon:GalleryVerticalEnd}] as const)
          .map(t=><button type="button" key={t.id} aria-current={tab===t.id?'page':undefined} onClick={()=>setTab(t.id)}><t.icon size={16}/>{t.label}</button>)}
      </nav>
      {tab==='album'&&<>
        <div className="boop-album-controls"><label className="boop-album-search"><Search size={18}/><input aria-label="Search collectibles" placeholder="Find a discovery…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <select aria-label="Sort collectibles" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="recent">Newest first</option><option value="az">Name A–Z</option><option value="crafted">Most crafted</option></select>
        </div>
        <div className="boop-album-filter-row">{([{id:'all',label:'All stickers'},{id:'shiny',label:'✦ Shiny'},{id:'celestial',label:'✶ Celestial'},{id:'evolved',label:'❋ Evolved'}] as const).map(f=><button key={f.id} aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)}>{f.label}</button>)}</div>
        <div className="boop-album-section-label"><span>DISCOVERY INDEX</span><small>{shown.length} stickers</small></div>
        {shown.length?<div className="boop-sticker-grid">{shown.slice(0,visible).map((item,i)=><CollectorCard key={item.id} item={item} index={i} onOpen={()=>openItem(item)}/>)}</div>
          :<div className="boop-album-empty">No stickers match this filter. Try another collection category.</div>}
        {shown.length>visible&&<button className="boop-album-load" onClick={()=>setVisible(n=>n+72)}>Show more stickers <ChevronRight size={15}/></button>}
      </>}
      {tab==='sets'&&<>
        <p className="boop-album-intro">Complete a themed page by discovering every named item. Missing stickers stay as silhouettes until you craft them.</p>
        <div className="boop-album-set-list">{ALBUM_SETS.map(set=>{
          const progress=albumSetProgress(catalog,set.names);
          return <section className="boop-album-set" key={set.id}>
            <div className="boop-album-set-header"><span className="boop-set-icon">{set.emoji}</span><div><h2>{set.title}</h2><small>{set.subtitle}</small></div><b>{progress.count}/{progress.total}</b></div>
            <div className="boop-album-set-meter"><i style={{width:`${progress.count/progress.total*100}%`}}/></div>
            <div className="boop-sticker-grid boop-sticker-grid--set">{set.names.map((name,i)=>{
              const item=byName.get(name.toLowerCase());
              return item?<CollectorCard key={name} item={item} index={i} onOpen={()=>openItem(item)}/>
                :<div key={name} className="boop-sticker-card boop-sticker-locked"><span className="boop-sticker-index">#{String(i+1).padStart(3,'0')}</span><span className="boop-sticker-missing"><Lock size={23}/><span>?</span></span><span className="boop-sticker-name">{name}</span><span className="boop-sticker-footer"><small>Not discovered</small></span></div>;
            })}</div>
            {progress.complete&&<div className="boop-set-completed"><Check size={16}/> Set complete! You earned the collector completion stamp.</div>}
          </section>;
        })}</div>
      </>}
      {tab==='room'&&<>
        <div className="boop-room-toolbar"><div><h2>Your trophy room</h2><p>Arrange 12 favourites. Tap a frame to choose a collectible, or drag frames to swap them.</p></div>
          <button disabled={exporting} className="boop-album-outline-button" onClick={()=>void shareRoom()}><Share2 size={16}/>{exporting?'Preparing…':'Share gallery'}</button>
        </div>
        <div className="boop-room-themes" role="group" aria-label="Trophy room background">
          {([{id:'gallery',label:'Gallery white'},{id:'studio',label:'Soft studio'},{id:'night',label:'Midnight museum'}] as const).map(theme=>
            <button key={theme.id} aria-pressed={room.theme===theme.id} onClick={()=>persistRoom({...room,theme:theme.id})}>{theme.label}</button>)}
        </div>
        <div className={`boop-trophy-room theme-${room.theme}`}>
          <div className="boop-room-plaque">THE LITTLE MUSEUM <small>YOUR FAVOURITE DISCOVERIES</small></div>
          <div className="boop-room-shelves">{room.slots.map((slot,i)=>{
            const item=slot?byName.get(slot.name.toLowerCase()):null;
            return <div key={i} draggable={Boolean(item)} onDragStart={e=>e.dataTransfer.setData('text/plain',String(i))}
              onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));moveSlot(from,i);}}
              className={`boop-trophy-slot ${slot?'has-art':''} frame-${slot?.frame||'classic'}`}>
              <button className="boop-trophy-pick" type="button" onClick={()=>chooseSlot(i)}
                aria-label={item?`Change trophy ${i+1}: ${item.name}`:`Place trophy in slot ${i+1}`}>
                {item&&slot?<><CollectibleArt item={item} variant={slot.variant}/><strong>{item.name}</strong><small>{slot.variant==='normal'?evolutionFor(item).tier.name:slot.variant}</small></>
                  :<><Plus size={28}/><strong>Place a sticker</strong><small>Slot {i+1}</small></>}
              </button>
              {item&&<button className="boop-trophy-remove" onClick={()=>persistRoom({...room,slots:room.slots.map((s,j)=>i===j?null:s)})} aria-label={`Remove ${item.name} from display`}><X size={15}/></button>}
            </div>;
          })}</div>
        </div>
        {galleryNotice&&<p className="boop-gallery-notice" role="status">{galleryNotice}</p>}
        <p className="boop-album-footnote">Your room is included in Boop's device backup and cloud collection save. Sharing exports a PNG; it does not expose your private profile data.</p>
      </>}
      {tab==='foundry'&&<Suspense fallback={<div className="boop-album-empty">Opening the Foundry archive…</div>}>
        <LegacyArchive inspectedItem={inspectedItem} onCloseInspect={onCloseInspect}/>
      </Suspense>}
    </section>

    {selected&&<div className="boop-album-modal-backdrop" role="presentation" onClick={()=>setSelected(null)}>
      <section className="boop-album-detail" role="dialog" aria-modal="true" aria-label={`${selected.name} collectible details`} onClick={e=>e.stopPropagation()}>
        <button className="boop-album-close" aria-label="Close details" onClick={()=>setSelected(null)}><X size={21}/></button>
        <div className="boop-album-detail-hero">
          <CollectibleArt item={selected} variant={viewVariant}/>
          <div><span className="boop-album-kicker">COLLECTION STICKER</span><h2>{selected.name}</h2><p>{selected.explanation||'A curious new object for your collection.'}</p></div>
        </div>
        <div className="boop-album-detail-tabs" role="group" aria-label="Collector colorway">
          {(['normal','shiny','celestial'] as const).map(variant=><button key={variant}
            disabled={!availableVariants(selected).includes(variant)}
            aria-pressed={viewVariant===variant} onClick={()=>setViewVariant(variant)}>
            {variant==='normal'?'Standard':variant==='shiny'?'✦ Shiny':'✶ Celestial'}
            {!availableVariants(selected).includes(variant)&&<Lock size={12}/>}
          </button>)}
        </div>
        <div className="boop-album-detail-metadata">
          <span><b>Discovered</b>{selected.discoveredAt?new Date(selected.discoveredAt).toLocaleDateString():'Starter'}</span>
          <span><b>Crafted</b>{normalizeElementStats(selected).craftCount||0} times</span>
          <span><b>Recipes</b>{latestRecipes(selected).length}</span>
          <span><b>Variants</b>{availableVariants(selected).length}/3</span>
        </div>
        <div className="boop-album-evolution">
          <div className="boop-album-section-label"><span>DISCOVERY EVOLUTION</span><small>{evolutionFor(selected).tier.marker} {evolutionFor(selected).tier.name}</small></div>
          <div className="boop-evolution-milestones">{(['Discovered','Awakened','Ascended','Legendary'] as const).map((step,i)=><span key={step} className={evolutionFor(selected).level>=i?'is-unlocked':''}>{step}</span>)}</div>
          <div className="boop-album-set-meter"><i style={{width:`${evolutionFor(selected).progress}%`}}/></div>
          <small>{evolutionFor(selected).next
            ?`Next: ${evolutionFor(selected).next.minimumCrafts} crafts${evolutionFor(selected).next.minimumRecipes?` and ${evolutionFor(selected).next.minimumRecipes} distinct recipes`:''}.`
            :'Highest evolution reached. Your collection keeps growing.'}</small>
        </div>
        <div className="boop-album-detail-section"><h3><GitBranch size={17}/> Known recipes</h3>
          {latestRecipes(selected).length?latestRecipes(selected).map((recipe,i)=><div className="boop-recipe-chip" key={i}><span>{recipe.first}</span>＋<span>{recipe.second}</span><b>→ {selected.name}</b><small>{recipe.count}×</small></div>)
            :<p>No alternate recipes recorded yet. Keep experimenting.</p>}</div>
        <div className="boop-album-detail-section"><h3><Shuffle size={17}/> Discoveries made from this</h3>
          {descendants(selected).length?<div className="boop-descendant-row">{descendants(selected).map(item=><button key={item.id} onClick={()=>openItem(item)}>{item.emoji} {item.name}</button>)}</div>
            :<p>Craft with this element to discover what it can become.</p>}</div>
        <div className="boop-album-odds"><Star size={16}/> Published odds per craft: Shiny 1 in {SHINY_ODDS.toLocaleString()} · Celestial 1 in {CELESTIAL_ODDS.toLocaleString()}. Each roll is independent.</div>
        <button className="boop-album-primary" onClick={()=>{setSelected(null);setTab('room');chooseSlot(room.slots.findIndex(slot=>!slot)>=0?room.slots.findIndex(slot=>!slot):0);}}><Trophy size={16}/> Display in trophy room</button>
      </section>
    </div>}

    {slotPicker!==null&&<div className="boop-album-modal-backdrop" onClick={()=>setSlotPicker(null)}>
      <section className="boop-trophy-picker" role="dialog" aria-modal="true" aria-label="Select display collectible" onClick={e=>e.stopPropagation()}>
        <div className="boop-trophy-picker-head"><div><small>DISPLAY SLOT {slotPicker+1}</small><h2>Choose a collectible</h2></div><button aria-label="Close trophy picker" onClick={()=>setSlotPicker(null)}><X/></button></div>
        <label className="boop-album-search"><Search size={18}/><input aria-label="Search trophy items" placeholder="Search your collection…" value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)}/></label>
        <div className="boop-picker-options"><span>Frame</span>{(['classic','gold','holo'] as const).map(v=><button key={v} aria-pressed={frame===v} onClick={()=>setFrame(v)}>{v}</button>)}</div>
        <div className="boop-trophy-picker-grid">{catalog.filter(item=>item.name.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0,160).map(item=>
          <div className="boop-picker-item" key={item.id}><CollectibleArt item={item}/>
            <strong>{item.name}</strong>
            <div>{availableVariants(item).map(variant=><button key={variant} onClick={()=>assign(item,variant)}
              aria-label={`Display ${variant} ${item.name}`}>{variant==='normal'?'Place':variant==='shiny'?'✦ Shiny':'✶ Celestial'}</button>)}</div>
          </div>)}</div>
        {catalog.length>160&&<p className="boop-album-footnote">Use search to find items beyond the first 160.</p>}
      </section>
    </div>}
  </CraftSprites.Provider>;
}
