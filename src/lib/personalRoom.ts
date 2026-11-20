import type { InfiniteElement } from './infiniteCraftData';
import { availableVariants, type CollectorVariant } from './collectorData';
import { discoveryIdentity } from './unifiedCollection';
import { ROOM_STYLES, ROOM_REWARDS, roomDiscoveryProgress, roomRewardUnlocked, type RoomStyle } from './roomProgress';
export { ROOM_REWARDS } from './roomProgress';
export type { RoomDecoration } from './roomProgress';
export type RoomSurface='floor'|'left-shelf'|'right-shelf'|'display'|'desk';
export interface RoomPiece {surface?:RoomSurface;slot?:number;id:string;kind:'sprite'|'decoration';name:string;variant:CollectorVariant;nickname:string;x:number;y:number;size:number;flipped:boolean}
export interface PersonalRoom {style?:RoomStyle;id:string;name:string;pieces:RoomPiece[]}
export interface PersonalRooms {version:1;activeId:string;rooms:PersonalRoom[]}
export const MAX_ROOM_PIECES=20;
export const emptyPersonalRooms=():PersonalRooms=>({version:1,activeId:'room-1',rooms:[{id:'room-1',name:'Moonlit nook',pieces:[]}]});
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const safeId=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v);
const label=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function validPersonalRooms(v:unknown):v is PersonalRooms {
 if(!object(v)||v.version!==1||!Array.isArray(v.rooms)||v.rooms.length<1||v.rooms.length>3)return false;
 const ids=new Set<string>();
 for(const r of v.rooms){
  if(!object(r)||!safeId(r.id)||ids.has(r.id as string)||!label(r.name,40)||!Array.isArray(r.pieces)||r.pieces.length>MAX_ROOM_PIECES||(r.style!==undefined&&!ROOM_STYLES.some(s=>s.id===r.style)))return false;
  ids.add(r.id as string);const pieces=new Set<string>();
  for(const p of r.pieces){
   if(!object(p)||!safeId(p.id)||pieces.has(p.id as string)||!['sprite','decoration'].includes(p.kind as string)||!label(p.name,160)||typeof p.nickname!=='string'||p.nickname.length>32||typeof p.flipped!=='boolean'||!['normal','shiny','celestial','holo','glitch'].includes(p.variant as string))return false;
   if(!Number.isInteger(p.x)||Number(p.x)<0||Number(p.x)>8||!Number.isInteger(p.y)||Number(p.y)<0||Number(p.y)>8||!Number.isFinite(p.size)||Number(p.size)<0.65||Number(p.size)>1.5)return false;
   if(p.surface!==undefined&&!['floor','left-shelf','right-shelf','display','desk'].includes(p.surface as string))return false;
   if(p.slot!==undefined){
    if(!Number.isInteger(p.slot)||Number(p.slot)<0||Number(p.slot)>1)return false;
    if((p.surface==='display'||p.surface==='desk')&&p.slot!==0)return false;
   }
   if(p.kind==='decoration'&&!ROOM_REWARDS.some(r=>r.id===p.name))return false;
   pieces.add(p.id as string);
  }
 }
 return ids.has(v.activeId as string);
}
/** Filter against the current collection/reputation, never unlock a discovery by importing a room. */
export function sanitizePersonalRooms(raw:unknown,owned:readonly InfiniteElement[],reputation:number):PersonalRooms {
 if(!validPersonalRooms(raw))return emptyPersonalRooms();
 const names=new Map(owned.map(e=>[discoveryIdentity(e.name),e]));
 const count=roomDiscoveryProgress(owned).count;
 return {...raw,rooms:raw.rooms.map(r=>({...r,...(r.style&&ROOM_STYLES.find(s=>s.id===r.style)!.discoveries>count?{style:'moonlit' as const}:{}),pieces:r.pieces.flatMap(p=>{
  if(p.kind==='decoration')return ROOM_REWARDS.some(d=>d.id===p.name&&roomRewardUnlocked(d,owned,reputation))?[{...p}]:[];
  const e=names.get(discoveryIdentity(p.name));return e?[{...p,name:e.name,variant:availableVariants(e).includes(p.variant)?p.variant:'normal' as const}]:[];
 })}))};
}
/** Coordinates on the room floor; sorting x+y draws near objects over distant objects. */
export const roomPoint=(x:number,y:number)=>({left:50+(x-y)*3.8,top:54+(x+y)*2.2});
export function roomCell(left:number,top:number){
 const difference=(left-50)/3.8,sum=(top-54)/2.2;
 return {x:Math.max(0,Math.min(8,Math.round((sum+difference)/2))),y:Math.max(0,Math.min(8,Math.round((sum-difference)/2)))};
}

export const ROOM_SURFACES:ReadonlyArray<{id:RoomSurface;name:string;points:readonly {left:number;top:number}[]}>=[
 {id:'floor',name:'Room floor',points:[]},
 {id:'left-shelf',name:'Left shelf',points:[{left:29,top:29.8},{left:33.5,top:27.6}]},
 {id:'right-shelf',name:'Right shelf',points:[{left:40.2,top:29.6},{left:44,top:31.4}]},
 {id:'display',name:'Glass display',points:[{left:60.5,top:45}]},
 {id:'desk',name:'Desk',points:[{left:34.5,top:55}]},
];
export function piecePoint(p:RoomPiece,pieces:readonly RoomPiece[]=[]){
 if(p.surface&&p.surface!=='floor'){
  if(p.slot===undefined&&p.surface==='left-shelf')return {left:30,top:29};
  if(p.slot===undefined&&p.surface==='right-shelf')return {left:43,top:29};
  if(p.slot===undefined&&p.surface==='display')return {left:60.5,top:44};
  return ROOM_SURFACES.find(s=>s.id===p.surface)?.points[p.slot??0]??roomPoint(p.x,p.y);
 }
 const point=roomPoint(p.x,p.y);
 const stand=p.kind==='sprite'?pieces.find(s=>s.kind==='decoration'&&s.name==='display-stand'&&(!s.surface||s.surface==='floor')&&s.x===p.x&&s.y===p.y):undefined;
 return stand?{...point,top:point.top-6.5*stand.size}:point;
}
export function pieceWidth(p:RoomPiece){
 const width=p.kind==='sprite'?8.5:ROOM_REWARDS.find(d=>d.id===p.name)?.width??10;
 if(p.surface==='left-shelf')return Math.min(4.2,width*p.size*0.5);
 if(p.surface==='right-shelf')return Math.min(3.5,width*p.size*0.5);
 if(p.surface==='display')return Math.min(5.6,width*p.size*0.66);
 if(p.surface==='desk')return Math.min(8,width*p.size*0.66);
 return width*p.size;
}
export function pieceDepth(p:RoomPiece){
 // The export and live room share this exact order, including stand/sprite stacks.
 return (p.surface&&p.surface!=='floor'?piecePoint(p).top:roomPoint(p.x,p.y).top)*100+(p.kind==='sprite'?1:0);
}
