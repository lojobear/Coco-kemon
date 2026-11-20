import type { InfiniteElement } from '../lib/infiniteCraftData';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, Check, FlipHorizontal, Home, LockKeyhole, Pencil, Plus, Search, Share2, Sparkles, Star, Trash2, X } from 'lucide-react';
import { CraftSprite } from './CraftSprite';
import { BoopOrders, useOrderSnapshot } from './BoopOrders';
import { commitPersonalRooms, readPersonalRooms, SAVE_IMPORTED_EVENT } from '../lib/saveData';
import { availableVariants } from '../lib/collectorData';
import { emptyOrderProgress, orderReputation } from '../lib/orderProgress';
import { MAX_ROOM_PIECES, ROOM_REWARDS, decorationOffset, roomCell, piecePoint, type PersonalRooms, type RoomPiece, type RoomSurface } from '../lib/personalRoom';
import { discoveryIdentity } from '../lib/unifiedCollection';
import { isAndroidNativeShell, sendToAndroid } from '../lib/nativeShell';
import '../styles/personal-room.css';

const uid=()=>crypto.randomUUID();
export function PersonalRoom({onBack}:{onBack:()=>void}){
 const state=useOrderSnapshot(),reputation=orderReputation(state.wallet.orders??emptyOrderProgress());
 const [saved,setSaved]=useState(readPersonalRooms),[draft,setDraft]=useState(()=>saved),[editing,setEditing]=useState(false),[selected,setSelected]=useState(''),[query,setQuery]=useState(''),[tab,setTab]=useState<'sprites'|'decorations'>('sprites'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[exporting,setExporting]=useState(false);
 const scene=useRef<HTMLDivElement>(null),drag=useRef<{id:string;clientX:number;clientY:number;moved:boolean}|null>(null);
 const room=draft.rooms.find(r=>r.id===draft.activeId)!,piece=room.pieces.find(p=>p.id===selected),dirty=JSON.stringify(draft)!==JSON.stringify(saved);
 const collection=useMemo(()=>Array.from(new Map<string,InfiniteElement>(state.collection.map(e=>[discoveryIdentity(e.name),e] as const)).values()).sort((a,b)=>a.name.localeCompare(b.name)),[state.collection]);
 const shown=collection.filter(e=>e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0,60);
 const owned=piece?.kind==='sprite'?collection.find(e=>discoveryIdentity(e.name)===discoveryIdentity(piece.name)):undefined;
 useEffect(()=>{
  const refresh=()=>{const next=readPersonalRooms();setSaved(next);setDraft(next);setEditing(false);setSelected('');setMessage('Room restored from your game save.');};
  window.addEventListener(SAVE_IMPORTED_EVENT,refresh);return()=>window.removeEventListener(SAVE_IMPORTED_EVENT,refresh);
 },[]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 useEffect(()=>{
  const guard=(event:MouseEvent)=>{const target=event.target as HTMLElement;if(dirty&&target.closest('.boop-navigation button')&&!window.confirm('Discard unsaved room changes?')){event.preventDefault();event.stopImmediatePropagation();}};
  document.addEventListener('click',guard,true);return()=>document.removeEventListener('click',guard,true);
 },[dirty]);
 const updateRoom=(change:(r:typeof room)=>typeof room)=>setDraft(prev=>({...prev,rooms:prev.rooms.map(r=>r.id===prev.activeId?change(r):r)}));
 const updatePiece=(id:string,change:Partial<RoomPiece>)=>updateRoom(r=>({...r,pieces:r.pieces.map(p=>p.id===id?{...p,...change}:p)}));
 const persist=async(next:PersonalRooms)=>{
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{await commitPersonalRooms(next);setSaved(next);setDraft(next);setEditing(false);setSelected('');setMessage('Room saved with your game progress.');}
  catch(e){setError(e instanceof Error?e.message:'Could not save your room. Please retry.');}
  finally{setBusy(false);}
 };
 const leave=()=>{if(dirty&&!window.confirm('Discard unsaved room changes?'))return;onBack();};
 useEffect(()=>{const back=()=>{if(busy)return;if(editing){if(dirty&&!window.confirm('Discard unsaved room changes?'))return;setDraft(saved);setEditing(false);setSelected('');}else onBack();};window.addEventListener('boop-native-back',back);return()=>window.removeEventListener('boop-native-back',back);},[busy,editing,dirty,saved,onBack]);
 const add=(kind:RoomPiece['kind'],name:string)=>{
  if(room.pieces.length>=MAX_ROOM_PIECES){setError('This room holds 20 pieces. Remove one or use another room.');return;}
  const id=uid(),occupied=new Set(room.pieces.map(p=>`${p.x},${p.y}`));let x=4,y=4;
  for(const [a,b] of [[4,4],[2,4],[4,2],[6,4],[4,6],[2,2],[6,6],[2,6],[6,2]])if(!occupied.has(`${a},${b}`)){x=a;y=b;break;}
  updateRoom(r=>({...r,pieces:[...r.pieces,{id,kind,name,variant:'normal',nickname:'',x,y,size:1,flipped:false}]}));setSelected(id);setError('');setMessage('Tap the floor, drag it, or choose a shelf in the piece controls.');
 };
 const moveAt=(clientX:number,clientY:number,id:string)=>{const bounds=scene.current?.getBoundingClientRect();if(!bounds)return;updatePiece(id,{...roomCell((clientX-bounds.left)/bounds.width*100,(clientY-bounds.top)/bounds.height*100),surface:'floor'});};
 const down=(e:PointerEvent<HTMLButtonElement>,id:string)=>{if(!editing||busy)return;e.preventDefault();e.stopPropagation();setSelected(id);drag.current={id,clientX:e.clientX,clientY:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);};
 const move=(e:PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d)return;if(Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)>5)d.moved=true;if(d.moved)moveAt(e.clientX,e.clientY,d.id);};
 const share=async()=>{
  if(exporting||dirty)return;setExporting(true);setError('');
  try{
   const root=scene.current!;await document.fonts.ready;const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1100;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#15171b';ctx.fillRect(0,0,1536,1100);
   const image=async(src:string)=>{const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();return img;};
   ctx.drawImage(await image('/room/moonlit-room.png'),0,0,1536,1024);
   for(const p of [...room.pieces].sort((a,b)=>a.x+a.y-b.x-b.y)){
    const img=root.querySelector<HTMLImageElement>(`[data-piece-id="${p.id}"] img`);if(!img)throw new Error('Wait for your sprite artwork to load, then export again.');
    const asset=await image(img.currentSrc||img.src),point=piecePoint(p,room.pieces),width=1536*(p.kind==='sprite'?0.085:0.24)*p.size,height=width;
    ctx.save();ctx.filter=p.variant==='holo'?'hue-rotate(45deg) saturate(1.3)':p.variant==='glitch'?'hue-rotate(120deg)':p.variant==='celestial'?'drop-shadow(0px 0px 6px #ffda87)':'none';ctx.translate(point.left/100*1536,point.top/100*1024);ctx.scale(p.flipped?-1:1,1);const fit=Math.min(width/asset.width,height/asset.height);if(p.kind==='decoration')ctx.translate(0,height*decorationOffset(p.name));ctx.drawImage(asset,-asset.width*fit/2,-height+(height-asset.height*fit)/2,asset.width*fit,asset.height*fit);ctx.restore();
   }
   ctx.fillStyle='#f0f1f5';ctx.font='bold 30px sans-serif';ctx.fillText(`${room.name} · Boop`,48,1070);
   const data=canvas.toDataURL('image/png');
   if(isAndroidNativeShell()&&/BoopAndroid\/([4-9]|[1-9]\d+)/.test(navigator.userAgent)&&sendToAndroid({type:'exportRoomImage',url:data})){setMessage('Choose where to save your room image.');return;}
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not export image.')),'image/png'));
   const file=new File([blob],'boop-room.png',{type:'image/png'});
   if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:room.name});
   else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='boop-room.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
   setMessage('Room image exported.');
  }catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Could not export your room.');}finally{setExporting(false);}
 };
 const next=ROOM_REWARDS.find(r=>r.reputation>reputation);
 return <section className="personal-room" aria-label="My room">
  <div className="room-topline"><button onClick={leave} disabled={busy}><ArrowLeft size={18}/> Profile</button><span><Star size={15}/>{reputation} reputation</span></div>
  <header className="room-heading"><div><small>A LITTLE SPACE THAT’S ALL YOU.</small><h1>{room.name}</h1><p>Your favorite discoveries, feeling at home.</p></div><div className="room-actions">
   {!editing?<><button className="room-primary" onClick={()=>{setEditing(true);setMessage('');}}><Pencil size={17}/>Edit room</button><button onClick={()=>void share()} disabled={exporting}>{exporting?'Preparing…':<><Share2 size={17}/>Share room</>}</button></>:<><button className="room-primary" disabled={busy} onClick={()=>void persist(draft)}><Check size={17}/>{busy?'Saving…':'Save room'}</button><button disabled={busy} onClick={()=>{setDraft(saved);setEditing(false);setSelected('');setError('');}}>Cancel</button></>}
  </div></header>
  <div className="room-selector"><label>Room<select aria-label="Choose room" disabled={editing||busy} value={draft.activeId} onChange={e=>void persist({...draft,activeId:e.target.value})}>{draft.rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><span>{draft.rooms.length} / 3 rooms</span><button aria-label="New room" disabled={draft.rooms.length>=3||editing||busy} onClick={()=>{const id=uid();setDraft(prev=>({...prev,activeId:id,rooms:[...prev.rooms,{id,name:`My room ${prev.rooms.length+1}`,pieces:[]}]}));setEditing(true);setSelected('');}}> <Plus size={16}/><span>New room</span></button></div>
  {message&&<p className="room-message" role="status">{message}</p>}{error&&<p className="room-error" role="alert">{error}</p>}
  <div className="room-layout"><div className="room-stage-column">
   <div ref={scene} className={`room-scene ${editing?'is-editing':''}`} aria-label="Isometric room" onClick={e=>{if(editing&&selected&&!busy)moveAt(e.clientX,e.clientY,selected);}}>
    <img className="room-backdrop" src="/room/moonlit-room.png" alt="Cozy isometric room with moonlit window, wooden floor, desk, plants and a purple armchair" draggable={false}/>
    <span className="room-badge">{editing?(dirty?'Unsaved changes':'Editing room'):<><Check size={12}/>Room saved</>}</span>
    {[...room.pieces].sort((a,b)=>a.x+a.y-b.x-b.y).map(p=>{const at=piecePoint(p,room.pieces),element=collection.find(e=>discoveryIdentity(e.name)===discoveryIdentity(p.name));return <button key={p.id} type="button" data-piece-id={p.id} aria-label={`${editing?'Select':'View'} ${p.nickname||p.name}`} aria-pressed={selected===p.id} className={`room-piece ${p.kind} ${selected===p.id?'is-selected':''} variant-${p.variant}`} style={{left:`${at.left}%`,top:`${at.top}%`,width:`${(p.kind==='sprite'?8.5:24)*p.size}%`,zIndex:p.surface&&p.surface!=='floor'?1:2*(p.x+p.y)+(p.kind==='sprite'?3:2)}} onClick={e=>{e.stopPropagation();if(!busy)setSelected(p.id);}} onPointerDown={e=>down(e,p.id)} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
     <span className="room-piece-art" style={{transform:p.flipped?'scaleX(-1)':undefined}}>{p.kind==='sprite'?<CraftSprite name={p.name} emoji={element?.emoji||''} isShiny={p.variant==='shiny'} idle={false}/>:<img style={{transform:`translateY(${decorationOffset(p.name)*100}%)`}} src={`/room/${p.name}.png`} alt={ROOM_REWARDS.find(r=>r.id===p.name)?.name} draggable={false}/>}</span>
     {selected===p.id&&<span className="room-piece-caption">{p.nickname||element?.name||ROOM_REWARDS.find(r=>r.id===p.name)?.name}</span>}
    </button>;})}
   </div>
   {!room.pieces.length&&<div className="room-empty"><Home size={22}/><div><strong>Your room is ready for you.</strong><p>Edit your room to place your first discovery. Your collection stays yours.</p></div>{!editing&&<button className="room-primary" onClick={()=>setEditing(true)}>Start decorating</button>}</div>}
   {editing&&<p className="room-hint">Select a piece, then tap the floor to place it. You can also drag or use the position controls. Placing never uses a crafted copy.</p>}
   {!editing&&<section className="room-favorites"><h2>Your favorite finds <small>{room.pieces.filter(p=>p.kind==='sprite').length} featured</small></h2><div>{room.pieces.filter(p=>p.kind==='sprite').slice(0,6).map(p=><button key={p.id} onClick={()=>setSelected(p.id)}><CraftSprite name={p.name} emoji={collection.find(e=>e.name===p.name)?.emoji||''} idle={false}/><strong>{p.name}</strong><small>{p.nickname||'Featured discovery'}</small></button>)}</div></section>}
  </div><aside className="room-sidebar">
   {editing?<>
    <div className="room-panel"><h2>Make it yours</h2><label>Room name<input aria-label="Room name" maxLength={40} value={room.name} disabled={busy} onChange={e=>updateRoom(r=>({...r,name:e.target.value}))}/></label><small>{room.pieces.length} / {MAX_ROOM_PIECES} pieces placed</small>{draft.rooms.length>1&&<button disabled={busy} onClick={()=>{if(!window.confirm(`Delete ${room.name}? Save to confirm this change.`))return;setDraft(prev=>{const rooms=prev.rooms.filter(r=>r.id!==prev.activeId);return {...prev,rooms,activeId:rooms[0].id};});setSelected('');}}><Trash2 size={15}/>Delete room</button>}</div>
    {piece&&<div className="room-panel room-piece-controls"><h2>{piece.kind==='sprite'?piece.name:ROOM_REWARDS.find(r=>r.id===piece.name)?.name}</h2><label>Nickname<input aria-label="Piece nickname" maxLength={32} value={piece.nickname} disabled={busy} onChange={e=>updatePiece(piece.id,{nickname:e.target.value})}/></label>
     {owned&&<label>Form<select aria-label="Piece form" value={piece.variant} disabled={busy} onChange={e=>updatePiece(piece.id,{variant:e.target.value as RoomPiece['variant']})}>{availableVariants(owned).map(v=><option key={v} value={v}>{v}</option>)}</select></label>}
     <label>Size<input aria-label="Piece size" type="range" min="0.65" max="1.5" step="0.05" value={piece.size} disabled={busy} onChange={e=>updatePiece(piece.id,{size:Number(e.target.value)})}/></label>
     <label>Place on<select aria-label="Piece surface" value={piece.surface||'floor'} disabled={busy} onChange={e=>updatePiece(piece.id,{surface:e.target.value as RoomSurface})}><option value="floor">Room floor</option><option value="left-shelf">Left shelf</option><option value="right-shelf">Right shelf</option><option value="display">Glass display</option></select></label>
     {(!piece.surface||piece.surface==='floor')&&<div className="room-position"><label>Floor column<input aria-label="Floor column" type="range" min="0" max="8" step="1" value={piece.x} disabled={busy} onChange={e=>updatePiece(piece.id,{x:Number(e.target.value)})}/></label><label>Floor row<input aria-label="Floor row" type="range" min="0" max="8" step="1" value={piece.y} disabled={busy} onChange={e=>updatePiece(piece.id,{y:Number(e.target.value)})}/></label></div>}
     <div className="room-control-row"><button disabled={busy} onClick={()=>updatePiece(piece.id,{flipped:!piece.flipped})}><FlipHorizontal size={16}/>Flip</button><button disabled={busy} onClick={()=>{updateRoom(r=>({...r,pieces:r.pieces.filter(p=>p.id!==piece.id)}));setSelected('');}}><Trash2 size={16}/>Remove</button><button disabled={busy} onClick={()=>setSelected('')} aria-label="Deselect piece"><X size={16}/></button></div>
    </div>}
    <div className="room-panel room-picker"><div className="room-picker-tabs"><button disabled={busy} aria-pressed={tab==='sprites'} onClick={()=>setTab('sprites')}>Discoveries</button><button disabled={busy} aria-pressed={tab==='decorations'} onClick={()=>setTab('decorations')}>Decorations</button></div>
     {tab==='sprites'?<><label className="room-search"><Search size={16}/><input aria-label="Search room discoveries" placeholder="Find a discovery…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="room-piece-library">{shown.map(e=><button key={e.id} aria-label={`Place ${e.name}`} disabled={busy||room.pieces.length>=MAX_ROOM_PIECES} onClick={()=>add('sprite',e.name)}><CraftSprite name={e.name} emoji={e.emoji} idle={false}/><span>{e.name}</span><Plus size={13}/></button>)}</div>{!shown.length&&<p>No discoveries match. Try another name.</p>}{collection.filter(e=>e.name.toLowerCase().includes(query.toLowerCase())).length>60&&<small>Showing 60 finds. Search to narrow your collection.</small>}</>:<div className="room-piece-library">{ROOM_REWARDS.map(d=><button key={d.id} aria-label={`Place ${d.name}${reputation<d.reputation?`, unlocks at ${d.reputation} reputation`:``}`} disabled={busy||reputation<d.reputation||room.pieces.length>=MAX_ROOM_PIECES} onClick={()=>add('decoration',d.id)}><img src={`/room/${d.id}.png`} alt=""/><span>{d.name}</span>{reputation<d.reputation?<small><LockKeyhole size={12}/>{d.reputation} rep</small>:<Plus size={13}/>}</button>)}</div>}
    </div>
   </>:<>
    <div className="room-panel"><Sparkles size={23}/><h2>A little room. A lot of you.</h2><p>Display your favorite discoveries. Give them nicknames, pick unlocked forms, and arrange them on the floor.</p><strong>{room.pieces.length} pieces placed</strong><button className="room-primary" onClick={()=>setEditing(true)}><Pencil size={16}/>Arrange your room</button></div>
    <div className="room-panel"><Star size={23}/><h2>{next?'Your next room reward':'Every decoration unlocked'}</h2><strong>{next?.name||'Keep making discoveries'}</strong><p>{next?`${next.reputation-reputation} more reputation to unlock`:'Keep delivering Orders to grow your reputation.'}</p>{next&&<progress aria-label="Next room reward" value={reputation} max={next.reputation}/>}<BoopOrders state={state}/><small>Earn reputation by delivering crafted copies.</small></div>
   </>}
  </aside></div>
 </section>;
}
