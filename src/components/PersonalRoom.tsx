import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, Check, CirclePlus, FlipHorizontal, Home, LockKeyhole, Pencil, Plus, Search, Share2, Sparkles, Star, Trash2, X, Undo2, Redo2, Grid3X3, FlaskConical, Gamepad2, Palette, Wand2 } from 'lucide-react';
import { CraftSprite, CraftSprites } from './CraftSprite';
import { RoomArtwork } from './RoomArtwork';
import { RoomClaw } from './RoomClaw';
import { BoopOrders, useOrderSnapshot } from './BoopOrders';
import { commitPersonalRooms, readPersonalRooms, SAVE_IMPORTED_EVENT } from '../lib/saveData';
import { availableVariants } from '../lib/collectorData';
import { emptyOrderProgress, orderReputation } from '../lib/orderProgress';
import { MAX_ROOM_PIECES, ROOM_SURFACES, pieceDepth, pieceWidth, piecePoint, type PersonalRooms, type PersonalRoom as Room, type RoomPiece, type RoomSurface } from '../lib/personalRoom';
import { ROOM_REWARDS, ROOM_STYLES, roomDiscoveryProgress, roomRewardUnlocked, roomRewardHint, type RoomDecoration } from '../lib/roomProgress';
import { nearestRoomPlacement, snapRoomPlacement, placementOpen, placementsFor, surfaceAllows, tidyRoomPieces, type Placement } from '../lib/roomPlacement';
import { roomArtworkBounds } from '../lib/roomArtwork';
import { nextRoomDiscovery, recentRoomFinds, ROOM_DISCOVERY_REQUEST, ROOM_DISPLAY_REQUEST } from '../lib/roomDiscoveryGoals';
import { discoveryIdentity } from '../lib/unifiedCollection';
import { isAndroidNativeShell, sendToAndroid } from '../lib/nativeShell';
import '../styles/personal-room.css';

const uid=()=>crypto.randomUUID();
export function PersonalRoom({onBack,onDiscover}:{onBack?:()=>void;onDiscover?:()=>void}){
 const state=useOrderSnapshot(),reputation=orderReputation(state.wallet.orders??emptyOrderProgress());
 const [saved,setSaved]=useState(readPersonalRooms),[draft,setDraft]=useState(()=>saved),[editing,setEditing]=useState(false),[selected,setSelected]=useState(''),[query,setQuery]=useState(''),[tab,setTab]=useState<'sprites'|'decorations'|'styles'>('sprites'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[exporting,setExporting]=useState(false),[guides,setGuides]=useState(true);
 const [clawOpen,setClawOpen]=useState(false);
 const [history,setHistory]=useState<{past:PersonalRooms[];future:PersonalRooms[]}>({past:[],future:[]});
 const [preview,setPreview]=useState<{id:string;at:Placement|null}|null>(null);
 const scene=useRef<HTMLDivElement>(null),drag=useRef<{id:string;clientX:number;clientY:number;offsetX:number;offsetY:number;moved:boolean;at:Placement|null}|null>(null);
 const room=draft.rooms.find(r=>r.id===draft.activeId)!,piece=room.pieces.find(p=>p.id===selected),dirty=JSON.stringify(draft)!==JSON.stringify(saved);
 const collection=useMemo(()=>Array.from(new Map(state.collection.map(e=>[discoveryIdentity(e.name),e] as const)).values()),[state.collection]);
 const elementByName=useMemo(()=>new Map(collection.map(e=>[discoveryIdentity(e.name),e])),[collection]);
 const unlockedRewardIds=useMemo(()=>new Set(ROOM_REWARDS.filter(d=>roomRewardUnlocked(d,collection,reputation,draft.clawPrizes)).map(d=>d.id)),[collection,reputation,draft.clawPrizes]);
 const suggestedRecipe=useMemo(()=>nextRoomDiscovery(collection),[collection]);
 const recentFinds=useMemo(()=>recentRoomFinds(collection),[collection]);
 const spriteOverrides=useMemo(()=>new Map(collection.flatMap(e=>e.customSpriteUrl?[[discoveryIdentity(e.name),e.customSpriteUrl] as const]:[])),[collection]);
 const discovered=useMemo(()=>roomDiscoveryProgress(collection),[collection]);
 const shown=useMemo(()=>[...collection].filter(e=>e.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>(b.discoveredAt||b.firstCraftedAt||0)-(a.discoveredAt||a.firstCraftedAt||0)||a.name.localeCompare(b.name)).slice(0,60),[collection,query]);
 const owned=piece?.kind==='sprite'?elementByName.get(discoveryIdentity(piece.name)):undefined;
 const style=ROOM_STYLES.find(s=>s.id===(room.style||'moonlit'))!,[visibleImage,setVisibleImage]=useState(style.image),[styleError,setStyleError]=useState(''),[styleRetry,setStyleRetry]=useState(0);
 const styleLoading=visibleImage!==style.image;
 useEffect(()=>{let active=true;setStyleError('');const img=new Image();img.src=style.image;void img.decode().then(()=>{if(active)setVisibleImage(style.image);}).catch(()=>{if(active)setStyleError('Room style could not load. Your current room is still visible.');});return()=>{active=false;};},[style.image,styleRetry]);
 const resetHistory=()=>setHistory({past:[],future:[]});
 const change=(next:PersonalRooms)=>{if(busy||JSON.stringify(next)===JSON.stringify(draft))return;setHistory(h=>({past:[...h.past,draft].slice(-40),future:[]}));setDraft(next);setError('');};
 const changeRoom=(fn:(r:Room)=>Room)=>change({...draft,rooms:draft.rooms.map(r=>r.id===draft.activeId?fn(r):r)});
 const updatePiece=(id:string,patch:Partial<RoomPiece>)=>changeRoom(r=>({...r,pieces:r.pieces.map(p=>p.id===id?{...p,...patch}:p)}));
 const undo=()=>{const previous=history.past.at(-1);if(!previous)return;setHistory(h=>({past:h.past.slice(0,-1),future:[draft,...h.future]}));setDraft(previous);setSelected('');setError('');};
 const redo=()=>{const next=history.future[0];if(!next)return;setHistory(h=>({past:[...h.past,draft],future:h.future.slice(1)}));setDraft(next);setSelected('');setError('');};
 const cancel=()=>{setDraft(saved);setEditing(false);setSelected('');setError('');setPreview(null);resetHistory();};
 useEffect(()=>{const refresh=()=>{const next=readPersonalRooms();setSaved(next);setDraft(next);setEditing(false);setSelected('');setHistory({past:[],future:[]});setMessage('Room restored from your game save.');};window.addEventListener(SAVE_IMPORTED_EVENT,refresh);return()=>window.removeEventListener(SAVE_IMPORTED_EVENT,refresh);},[]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 useEffect(()=>{
  const blocked=()=>dirty&&!window.confirm('Discard unsaved room changes?');
  const guard=(event:MouseEvent)=>{if((event.target as HTMLElement).closest('.boop-navigation button,.collection-brand-name,.header-actions button')&&blocked()){event.preventDefault();event.stopImmediatePropagation();}};
  const nativeGuard=(event:Event)=>{if(blocked()){event.preventDefault();event.stopImmediatePropagation();sendToAndroid({type:'tab',tab:'rooms'});}};
  document.addEventListener('click',guard,true);window.addEventListener('boop-native-tab',nativeGuard,true);return()=>{document.removeEventListener('click',guard,true);window.removeEventListener('boop-native-tab',nativeGuard,true);};
 },[dirty]);
 useEffect(()=>{const back=(event:Event)=>{const modal=document.querySelector<HTMLDialogElement>('.personal-room dialog[open]');if(modal){event.stopImmediatePropagation();if(modal.dispatchEvent(new Event('cancel',{cancelable:true})))modal.close();return;}if(busy)return;if(editing){if(dirty&&!window.confirm('Discard unsaved room changes?'))return;cancel();}else onBack?.();};window.addEventListener('boop-native-back',back,true);return()=>window.removeEventListener('boop-native-back',back,true);},[busy,editing,dirty,saved,onBack]);
 const persist=async(next:PersonalRooms)=>{
  if(busy||styleLoading||styleError)return;setBusy(true);setError('');setMessage('');
  try{await commitPersonalRooms(next);setSaved(next);setDraft(next);setEditing(false);setSelected('');resetHistory();setMessage('Room saved with your game progress.');requestAnimationFrame(()=>scene.current?.closest('.personal-room')?.scrollIntoView({block:'start'}));}
  catch(e){setError(e instanceof Error?e.message:'Could not save your room. Please retry.');}finally{setBusy(false);}
 };
 const saveClawPrize=useCallback(async(id:RoomDecoration)=>{
  const next=await commitPersonalRooms(current=>current.clawPrizes?.includes(id)?current:
   {...current,clawPrizes:[...(current.clawPrizes??[]),id]});
  setSaved(next);setDraft(next);
 },[]);
 const leave=()=>{if(dirty&&!window.confirm('Discard unsaved room changes?'))return;onBack?.();};
 const beginEdit=(nextTab:'sprites'|'decorations'|'styles'='sprites')=>{setEditing(true);setTab(nextTab);setMessage('');};
 const add=(kind:RoomPiece['kind'],name:string)=>{
  if(busy)return;if(room.pieces.length>=MAX_ROOM_PIECES){setError('This room holds 20 pieces. Remove one or use another room.');return;}
  const added:RoomPiece={id:uid(),kind,name,variant:'normal',nickname:'',x:4,y:4,size:1,flipped:false};
  const at=nearestRoomPlacement(added,'floor',room.pieces)??ROOM_SURFACES.flatMap(s=>nearestRoomPlacement(added,s.id,room.pieces)??[])[0];
  if(!at){setError('There is no free spot for this piece. Remove a piece or use another room.');return;}
  changeRoom(r=>({...r,pieces:[...r.pieces,{...added,...at}]}));setSelected(added.id);setMessage('Tap a guide or drag to a surface.');requestAnimationFrame(()=>{if(window.innerWidth>900)return;const control=document.querySelector('.room-piece-controls'),scroller=document.querySelector('.boop-main'),stage=document.querySelector('.room-stage-column');if(control&&scroller&&stage)scroller.scrollTop+=control.getBoundingClientRect().top-scroller.getBoundingClientRect().top-stage.getBoundingClientRect().height-12;});
 };
 useEffect(()=>{
  let name='';try{name=sessionStorage.getItem(ROOM_DISPLAY_REQUEST)||'';sessionStorage.removeItem(ROOM_DISPLAY_REQUEST);}catch{/* Optional shortcut. */}
  const found=collection.find(e=>discoveryIdentity(e.name)===discoveryIdentity(name));if(found){setEditing(true);setTab('sprites');setQuery(found.name);setMessage(`${found.name} is ready to display. Choose it below to place it in this room.`);}
 },[]);
 const put=(id:string,at:Placement|null)=>{if(!at){setError('No free spot there. Choose a highlighted surface or floor cell.');return;}updatePiece(id,at);setMessage('Piece placed. Save your room when you’re happy with it.');};
 const cursor=(clientX:number,clientY:number)=>{const b=scene.current?.getBoundingClientRect();return b?{left:(clientX-b.left)/b.width*100,top:(clientY-b.top)/b.height*100}:null;};
 const tapAt=(clientX:number,clientY:number)=>{const at=cursor(clientX,clientY);if(piece&&at)put(piece.id,snapRoomPlacement(piece,at.left,at.top,room.pieces));};
 const down=(e:PointerEvent<HTMLButtonElement>,p:RoomPiece)=>{if(!editing||busy)return;e.preventDefault();e.stopPropagation();setSelected(p.id);const at=cursor(e.clientX,e.clientY)!,origin=piecePoint(p,room.pieces);drag.current={id:p.id,clientX:e.clientX,clientY:e.clientY,offsetX:at.left-origin.left,offsetY:at.top-origin.top,moved:false,at:null};e.currentTarget.setPointerCapture(e.pointerId);};
 const move=(e:PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d)return;if(Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)>5)d.moved=true;if(!d.moved)return;const p=room.pieces.find(p=>p.id===d.id),at=cursor(e.clientX,e.clientY);if(!p||!at)return;d.at=snapRoomPlacement(p,at.left-d.offsetX,at.top-d.offsetY,room.pieces);setPreview({id:d.id,at:d.at});};
 const finishDrag=()=>{const d=drag.current;drag.current=null;setPreview(null);if(d?.moved)put(d.id,d.at);};
 const chooseSurface=(surface:RoomSurface)=>{if(piece)put(piece.id,nearestRoomPlacement(piece,surface,room.pieces));};
 const adjustSize=(size:number)=>{if(!piece)return;const next={...piece,size};if(!placementOpen(next,next,room.pieces)){setError('That size would overlap another piece. Move it or choose a smaller size.');return;}updatePiece(piece.id,{size});};
 const discover=()=>{
  if(dirty&&!window.confirm('Discard unsaved room changes?'))return;
  const recipe=suggestedRecipe;
  if(recipe){try{sessionStorage.setItem(ROOM_DISCOVERY_REQUEST,JSON.stringify(recipe));}catch{/* Craft remains accessible without the shortcut. */}}
  onDiscover?.();
 };
 const share=async()=>{
  if(exporting||dirty||styleLoading||styleError)return;setExporting(true);setError('');
  try{
   const root=scene.current!;const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1100;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#15171b';ctx.fillRect(0,0,1536,1100);
   const image=async(src:string)=>{const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();return img;};ctx.drawImage(await image(style.image),0,0,1536,1024);
   for(const p of [...room.pieces].sort((a,b)=>pieceDepth(a)-pieceDepth(b))){
    const img=root.querySelector<HTMLImageElement>(`[data-piece-id="${p.id}"] img`);if(!img?.complete||!img.naturalWidth)throw new Error('Wait for your sprite artwork to load, then export again.');
    const asset=await image(img.currentSrc||img.src),bounds=roomArtworkBounds(asset),point=piecePoint(p,room.pieces),box=1536*pieceWidth(p)/100,fit=box/Math.max(bounds.width,bounds.height),w=bounds.width*fit,h=bounds.height*fit;
    ctx.save();ctx.filter=p.variant==='shiny'&&!img.closest('.boop-shiny-authored')?'sepia(.8) saturate(2.5) hue-rotate(162deg) contrast(1.12) brightness(1.08)':p.variant==='holo'?'hue-rotate(45deg) saturate(1.3)':p.variant==='glitch'?'hue-rotate(120deg)':p.variant==='celestial'?'drop-shadow(0px 0px 6px #ffda87)':'none';ctx.translate(point.left/100*1536,point.top/100*1024);ctx.scale(p.flipped?-1:1,1);ctx.drawImage(asset,bounds.x,bounds.y,bounds.width,bounds.height,-w/2,-h,w,h);ctx.restore();
   }
   ctx.fillStyle='#f0f1f5';ctx.font='bold 30px sans-serif';ctx.fillText(`${room.name} · Boop`,48,1070);
   if(isAndroidNativeShell()&&/BoopAndroid\/([4-9]|[1-9]\d+)/.test(navigator.userAgent)&&sendToAndroid({type:'exportRoomImage',url:canvas.toDataURL('image/png')})){setMessage('Choose where to save your room image.');return;}
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not export image.')),'image/png')),file=new File([blob],'boop-room.png',{type:'image/png'});
   if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:room.name});else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='boop-room.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}setMessage('Room image exported.');
  }catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Could not export your room.');}finally{setExporting(false);}
 };
 const nextStyle=ROOM_STYLES.find(s=>s.discoveries>discovered.count),unlockedDecor=unlockedRewardIds.size,recipe=suggestedRecipe;
 const recent=recentFinds,featured=room.pieces.filter(p=>p.kind==='sprite'),distinctDisplayed=new Set(featured.map(p=>discoveryIdentity(p.name))).size;
 const targets=editing&&guides&&piece?ROOM_SURFACES.flatMap(s=>placementsFor(piece,s.id)).filter(at=>placementOpen(piece,at,room.pieces)):[];
 return <CraftSprites.Provider value={spriteOverrides}><section className="personal-room" aria-label="My room">
  <div className="room-topline">{onBack?<button onClick={leave} disabled={busy}><ArrowLeft size={18}/> Profile</button>:<span className="room-studio-label"><Home size={16}/>Your studio</span>}<span><Sparkles size={15}/>{discovered.count} discoveries <Star size={15}/>{reputation} reputation</span></div>
  <header className="room-heading"><div><small>DISCOVER SOMETHING. MAKE IT YOURS.</small><h1>{room.name}</h1><p>New discoveries become the things that make your room yours.</p></div><div className="room-actions">
   {!editing?<><button type="button" disabled={busy} onClick={()=>setClawOpen(true)}><Gamepad2 size={17}/>Boop Claw</button><button className="room-primary" onClick={()=>beginEdit()}><Pencil size={17}/>Edit room</button><button onClick={()=>void share()} disabled={exporting||styleLoading||!!styleError}>{exporting?'Preparing…':<><Share2 size={17}/>Share room</>}</button></>:<><button className="room-primary" disabled={busy||styleLoading||!!styleError} onClick={()=>void persist(draft)}><Check size={17}/>{busy?'Saving…':'Save room'}</button><button disabled={busy} onClick={cancel}>Cancel</button></>}
  </div></header>
  {clawOpen&&<RoomClaw onClose={()=>setClawOpen(false)} onPrize={saveClawPrize}/>}
  <div className="room-selector"><label>Room<select aria-label="Choose room" disabled={editing||busy} value={draft.activeId} onChange={e=>void persist({...draft,activeId:e.target.value})}>{draft.rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><span>{draft.rooms.length} / 3 rooms</span><button aria-label="New room" disabled={draft.rooms.length>=3||editing||busy} onClick={()=>{const id=uid();change({...draft,activeId:id,rooms:[...draft.rooms,{id,name:`My room ${draft.rooms.length+1}`,pieces:[]}]});setEditing(true);setSelected('');}}><Plus size={16}/><span>New room</span></button>{!editing&&<button aria-label="Choose room style" onClick={()=>beginEdit('styles')}><Palette size={16}/><span>Styles</span></button>}</div>
  {message&&<p className="room-message" role="status">{message}</p>}{error&&<p className="room-error" role="alert">{error}</p>}{styleError&&<p className="room-error" role="alert">{styleError}<button onClick={()=>setStyleRetry(n=>n+1)}>Retry room style</button></p>}
  <div className="room-layout"><div className={`room-stage-column ${editing?'is-editing':''}`}>
   <div ref={scene} className={`room-scene ${editing?'is-editing':''} ${preview&&!preview.at?'invalid-drop':''}`} aria-label="Isometric room" onClick={e=>{if(editing&&selected&&!busy)tapAt(e.clientX,e.clientY);}}>
    <img className="room-backdrop" src={visibleImage} alt={`${ROOM_STYLES.find(s=>s.image===visibleImage)?.name||'Cozy'} isometric room with shelves, glass display and an open wooden floor`} draggable={false}/>
    <span className="room-badge">{styleLoading?'Loading room style…':editing?(dirty?'Unsaved changes':'Editing room'):<><Check size={12}/>Room saved</>}</span>
    {targets.map(at=>{const point=piecePoint({...piece!,...at},room.pieces);return <button key={`${at.surface}-${at.slot??`${at.x}-${at.y}`}`} className={`room-placement-target ${at.surface==='floor'?'floor':'surface'}`} style={{left:`${point.left}%`,top:`${point.top}%`}} aria-label={`Place selected piece on ${at.surface==='floor'?`floor ${at.x},${at.y}`:`${ROOM_SURFACES.find(s=>s.id===at.surface)?.name} ${(at.slot??0)+1}`}`} onClick={e=>{e.stopPropagation();put(selected,at);}}><CirclePlus size={at.surface==='floor'?14:22}/></button>;})}
    {[...room.pieces].sort((a,b)=>pieceDepth(a)-pieceDepth(b)).map(p=>{const displayed=preview?.id===p.id&&preview.at?{...p,...preview.at}:p,at=piecePoint(displayed,room.pieces),element=elementByName.get(discoveryIdentity(p.name));return <button key={p.id} type="button" data-piece-id={p.id} aria-label={`${editing?'Select':'View'} ${p.nickname||p.name}`} aria-pressed={selected===p.id} className={`room-piece ${p.kind} ${selected===p.id?'is-selected':''} ${preview?.id===p.id?'is-dragging':''} variant-${p.variant}`} style={{left:`${at.left}%`,top:`${at.top}%`,width:`${pieceWidth(displayed)}%`,zIndex:Math.round(pieceDepth(displayed))}} onClick={e=>{e.stopPropagation();if(!busy)setSelected(p.id);}} onPointerDown={e=>down(e,p)} onPointerMove={move} onPointerUp={finishDrag} onPointerCancel={()=>{drag.current=null;setPreview(null);}} onLostPointerCapture={()=>{drag.current=null;setPreview(null);}}>
     <span className="room-piece-art" style={{transform:p.flipped?'scaleX(-1)':undefined}}><RoomArtwork name={p.name} emoji={element?.emoji||''} kind={p.kind} variant={p.variant}/></span>
     {selected===p.id&&!preview&&<span className="room-piece-caption">{p.nickname||element?.name||ROOM_REWARDS.find(r=>r.id===p.name)?.name}</span>}
    </button>;})}
   </div>
   {editing?<><div className="room-edit-toolbar"><button disabled={busy||!history.past.length} onClick={undo} aria-label="Undo room change"><Undo2 size={17}/><span>Undo</span></button><button disabled={busy||!history.future.length} onClick={redo} aria-label="Redo room change"><Redo2 size={17}/></button><button disabled={busy} aria-label="Placement guides" aria-pressed={guides} onClick={()=>setGuides(v=>!v)}><Grid3X3 size={17}/><span>Placement guides</span></button><button disabled={busy||!room.pieces.length} aria-label="Tidy room" onClick={()=>{const result=tidyRoomPieces(room.pieces);changeRoom(r=>({...r,pieces:result.pieces}));setMessage(result.unplaced.length?'Some pieces still need more room. Try a smaller size or another surface.':JSON.stringify(result.pieces)===JSON.stringify(room.pieces)?'Your room is already tidy.':'Pieces arranged into free spots. Undo restores your previous layout.');}}><Wand2 size={17}/></button><button className="room-primary room-mobile-save" disabled={busy||styleLoading||!!styleError} aria-label="Save room from editor" onClick={()=>void persist(draft)}><Check size={17}/>{busy?'Saving…':'Save'}</button></div><p className="room-hint">Drag or tap a guide to snap onto the floor, a shelf, desk, or display. Occupied spots are protected. Placing never uses a crafted copy.</p></>:<>
    <div className="room-discovery-loop"><div><small>YOUR NEXT CHAPTER</small><strong>{nextStyle?`${Math.max(0,nextStyle.discoveries-discovered.count)} more discoveries to unlock ${nextStyle.name}`:'A world of discoveries. A room that’s yours.'}</strong><p>{recipe?`Try ${recipe.first} + ${recipe.second}. Every new find can become room decor.`:'Explore new combinations, then bring your favorite finds home.'}</p></div>{onDiscover&&<button className="room-primary" onClick={discover}><FlaskConical size={18}/>Discover something new</button>}</div>
    {!room.pieces.length&&<div className="room-empty"><Home size={22}/><div><strong>Your room is ready for you.</strong><p>Choose any discovery to start decorating.</p></div><button onClick={()=>beginEdit()}>Start decorating</button></div>}
    <section className="room-favorites"><h2>{featured.length?'Your favorite finds':'Fresh discoveries'}<small>{featured.length?`${featured.length} featured`:`${discovered.count} discovered`}</small></h2><div>{featured.length?featured.slice(0,6).map(p=><button key={p.id} onClick={()=>{beginEdit();setSelected(p.id);}}><CraftSprite name={p.name} emoji={collection.find(e=>e.name===p.name)?.emoji||''} idle={false}/><strong>{p.name}</strong><small>{p.nickname||'Featured discovery'}</small></button>):recent.map(e=><button key={e.id} onClick={()=>{beginEdit();add('sprite',e.name);}}><CraftSprite name={e.name} emoji={e.emoji} idle={false}/><strong>{e.name}</strong><small>Place in room</small></button>)}</div></section>
   </>}
  </div><aside className="room-sidebar">
   {editing?<>
    <div className="room-panel"><h2>Make it yours</h2><label>Room name<input aria-label="Room name" maxLength={40} value={room.name} disabled={busy} onChange={e=>changeRoom(r=>({...r,name:e.target.value}))}/></label><small>{room.pieces.length} / {MAX_ROOM_PIECES} pieces placed · {style.name}</small>{room.pieces.length>0&&<label>Selected piece<select aria-label="Select placed piece" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a piece…</option>{room.pieces.map((p,i)=><option key={p.id} value={p.id}>{p.nickname|| (p.kind==='sprite'?p.name:ROOM_REWARDS.find(d=>d.id===p.name)?.name)} · {i+1}</option>)}</select></label>}{draft.rooms.length>1&&<button disabled={busy} onClick={()=>{if(!window.confirm(`Delete ${room.name}? Save to confirm this change.`))return;const rooms=draft.rooms.filter(r=>r.id!==draft.activeId);change({...draft,rooms,activeId:rooms[0].id});setSelected('');}}><Trash2 size={15}/>Delete room</button>}</div>
    {piece&&<div className="room-panel room-piece-controls"><h2>{piece.kind==='sprite'?piece.name:ROOM_REWARDS.find(r=>r.id===piece.name)?.name}</h2><label>Nickname<input aria-label="Piece nickname" maxLength={32} value={piece.nickname} disabled={busy} onChange={e=>updatePiece(piece.id,{nickname:e.target.value})}/></label>
     {owned&&<label>Form<select aria-label="Piece form" value={piece.variant} disabled={busy} onChange={e=>updatePiece(piece.id,{variant:e.target.value as RoomPiece['variant']})}>{availableVariants(owned).map(v=><option key={v} value={v}>{v}</option>)}</select></label>}
     <label>Size<input aria-label="Piece size" type="range" min="0.65" max="1.5" step="0.05" value={piece.size} disabled={busy} onChange={e=>adjustSize(Number(e.target.value))}/></label>
     <label>Place on<select aria-label="Piece surface" value={piece.surface||'floor'} disabled={busy} onChange={e=>chooseSurface(e.target.value as RoomSurface)}>{ROOM_SURFACES.filter(s=>surfaceAllows(piece,s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     {(!piece.surface||piece.surface==='floor')?<div className="room-position"><label>Floor column<input aria-label="Floor column" type="range" min="0" max="8" step="1" value={piece.x} disabled={busy} onChange={e=>put(piece.id,nearestRoomPlacement({...piece,x:Number(e.target.value)},'floor',room.pieces))}/></label><label>Floor row<input aria-label="Floor row" type="range" min="0" max="8" step="1" value={piece.y} disabled={busy} onChange={e=>put(piece.id,nearestRoomPlacement({...piece,y:Number(e.target.value)},'floor',room.pieces))}/></label></div>:<label>Surface position<select aria-label="Surface position" value={piece.slot??0} disabled={busy} onChange={e=>{const at={x:piece.x,y:piece.y,surface:piece.surface,slot:Number(e.target.value)};put(piece.id,placementOpen(piece,at,room.pieces)?at:null);}}>{ROOM_SURFACES.find(s=>s.id===piece.surface)?.points.map((_,slot)=><option key={slot} value={slot}>Spot {slot+1}</option>)}</select></label>}
     <div className="room-control-row"><button disabled={busy} onClick={()=>updatePiece(piece.id,{flipped:!piece.flipped})}><FlipHorizontal size={16}/>Flip</button><button disabled={busy} onClick={()=>{changeRoom(r=>({...r,pieces:r.pieces.filter(p=>p.id!==piece.id)}));setSelected('');}}><Trash2 size={16}/>Remove</button><button disabled={busy} onClick={()=>setSelected('')} aria-label="Deselect piece"><X size={16}/></button></div>
    </div>}
    <div className="room-panel room-picker"><div className="room-picker-tabs"><button disabled={busy} aria-pressed={tab==='sprites'} onClick={()=>setTab('sprites')}>Discoveries</button><button disabled={busy} aria-pressed={tab==='decorations'} onClick={()=>setTab('decorations')}>Decorations</button><button disabled={busy} aria-pressed={tab==='styles'} onClick={()=>setTab('styles')}>Styles</button></div>
     {tab==='sprites'?<><label className="room-search"><Search size={16}/><input aria-label="Search room discoveries" placeholder="Find a discovery…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="room-piece-library">{shown.map(e=><button key={e.id} aria-label={`Place ${e.name}`} disabled={busy||room.pieces.length>=MAX_ROOM_PIECES} onClick={()=>add('sprite',e.name)}><CraftSprite name={e.name} emoji={e.emoji} idle={false}/><span>{e.name}</span><Plus size={13}/></button>)}</div>{!shown.length&&<p>No discoveries match. Try another name.</p>}{collection.length>60&&<small>Showing up to 60 finds. Search to narrow your collection.</small>}</>:tab==='decorations'?<div className="room-piece-library">{ROOM_REWARDS.map(d=>{const unlocked=unlockedRewardIds.has(d.id);return <button key={d.id} aria-label={`Place ${d.name}${!unlocked?`, ${roomRewardHint(d)}`:''}`} disabled={busy||!unlocked||room.pieces.length>=MAX_ROOM_PIECES} onClick={()=>add('decoration',d.id)}><img src={`/room/${d.id}.png`} alt=""/><span>{d.name}</span>{!unlocked?<small><LockKeyhole size={12}/>{roomRewardHint(d)}</small>:<Plus size={13}/>}</button>;})}</div>:<div className="room-style-picker">{ROOM_STYLES.map(s=><button key={s.id} disabled={busy||discovered.count<s.discoveries} aria-pressed={style.id===s.id} aria-label={`Use ${s.name}${discovered.count<s.discoveries?`, unlocks at ${s.discoveries} discoveries`:''}`} onClick={()=>changeRoom(r=>({...r,style:s.id,name:r.name===style.name?s.name:r.name}))}><img src={s.image} alt="" loading="lazy"/><strong>{s.name}</strong><small>{discovered.count<s.discoveries?<><LockKeyhole size={12}/>{s.discoveries} discoveries</>:style.id===s.id?'Current style':s.description}</small></button>)}</div>}
    </div>
   </>:<>
    <div className="room-panel room-goals"><Sparkles size={23}/><h2>Discover. Decorate. Repeat.</h2><div><strong>{discovered.count} discoveries</strong><small>Every collected element is yours to display.</small></div><div><strong>{unlockedDecor} / {ROOM_REWARDS.length} decorations</strong><small>Unlock decor through discoveries, Orders, or Boop Claw.</small></div><div><strong>{Math.min(3,distinctDisplayed)} / 3 favorite finds displayed</strong><small>Make a room that tells your story.</small></div><button className="room-primary" onClick={()=>beginEdit()}><Pencil size={16}/>Arrange your room</button></div>
    <div className="room-panel"><Palette size={23}/><h2>{nextStyle?'Your next room style':'Every room style unlocked'}</h2><strong>{nextStyle?.name||'Keep making discoveries'}</strong><p>{nextStyle?`${nextStyle.discoveries-discovered.count} more unique discoveries to unlock`:'Try a different style without moving your pieces.'}</p>{nextStyle&&<progress aria-label="Next room style" value={discovered.count} max={nextStyle.discoveries}/>}<button onClick={()=>beginEdit('styles')}>Browse room styles</button><BoopOrders state={state}/><small>Orders reputation still unlocks your original decorations.</small></div>
   </>}
  </aside></div>
 </section></CraftSprites.Provider>;
}
