import { piecePoint, roomPoint, roomCell, validRoomPoint, ROOM_SURFACES, type RoomPiece, type RoomSurface } from './personalRoom';
import { ROOM_REWARDS } from './roomProgress';
export type Placement=Pick<RoomPiece,'x'|'y'|'surface'|'slot'|'free'>;
/** Precision placement uses normalized scene coordinates; deliberate overlap is allowed. */
export function freeRoomPlacement(left:number,top:number):Placement|null{
 const free={left:Math.round(left*100)/100,top:Math.round(top*100)/100};
 return validRoomPoint(free)?{...roomCell(free.left,free.top),surface:'floor',slot:undefined,free}:null;
}
export function surfaceAllows(piece:RoomPiece,surface:RoomSurface){
 return piece.kind==='sprite'||(ROOM_REWARDS.find(d=>d.id===piece.name)?.surfaces as readonly string[]|undefined)?.includes(surface)===true;
}
export function floorCellOpen(x:number,y:number){
 return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<=8&&y>=0&&y<=8;
}
const footprint=(p:RoomPiece)=>p.size*(p.kind==='sprite'?3.4:ROOM_REWARDS.find(d=>d.id===p.name)?.footprint??5);
export function placementOpen(piece:RoomPiece,at:Placement,pieces:readonly RoomPiece[]){
 if(at.free)return validRoomPoint(at.free);
 const surface=at.surface??'floor';if(!surfaceAllows(piece,surface))return false;
 const others=pieces.filter(p=>p.id!==piece.id&&!p.free);
 if(surface!=='floor'){
  const points=ROOM_SURFACES.find(s=>s.id===surface)?.points;if(!points?.[at.slot??0])return false;
  return !others.some(p=>p.surface===surface&&(p.slot??0)===(at.slot??0));
 }
 if(!floorCellOpen(at.x,at.y))return false;
 const same=others.filter(p=>(!p.surface||p.surface==='floor')&&p.x===at.x&&p.y===at.y);
 const canStack=piece.kind==='sprite'&&same.length===1&&same[0].kind==='decoration'&&same[0].name==='display-stand';
 const canSupport=piece.kind==='decoration'&&piece.name==='display-stand'&&same.length===1&&same[0].kind==='sprite';
 if(same.length&&!canStack&&!canSupport)return false;
 const a=roomPoint(at.x,at.y);
 return !others.some(p=>{
  if(p.surface&&p.surface!=='floor'||same.includes(p)&&(canStack||canSupport))return false;
  const b=roomPoint(p.x,p.y);
  return Math.hypot(a.left-b.left,(a.top-b.top)*2/3)<(footprint(piece)+footprint(p))/2;
 });
}
export function placementsFor(piece:RoomPiece,surface:RoomSurface):Placement[]{
 if(!surfaceAllows(piece,surface))return [];
 if(surface==='floor')return Array.from({length:81},(_,i)=>({x:i%9,y:Math.floor(i/9),surface,slot:undefined})).filter(p=>floorCellOpen(p.x,p.y));
 return (ROOM_SURFACES.find(s=>s.id===surface)?.points??[]).map((_,slot)=>({x:piece.x,y:piece.y,surface,slot}));
}
/** Snap only to surfaces close to the pointer. No wall/outside drops teleport onto the floor. */
export function snapRoomPlacement(piece:RoomPiece,left:number,top:number,pieces:readonly RoomPiece[]):Placement|null{
 const candidates=ROOM_SURFACES.flatMap(s=>placementsFor(piece,s.id)).map(at=>({at,point:piecePoint({...piece,free:undefined,...at},pieces)}));
 const sorted=candidates.map(c=>({...c,distance:Math.hypot(c.point.left-left,(c.point.top-top)*2/3)})).sort((a,b)=>a.distance-b.distance);
 for(const c of sorted){if(c.distance>7)break;if(placementOpen(piece,c.at,pieces))return c.at;}
 return null;
}
export function nearestRoomPlacement(piece:RoomPiece,surface:RoomSurface,pieces:readonly RoomPiece[]):Placement|null{
 const from=piecePoint(piece);return placementsFor(piece,surface).filter(at=>placementOpen(piece,at,pieces)).sort((a,b)=>{
  const p=piecePoint({...piece,free:undefined,...a}),q=piecePoint({...piece,free:undefined,...b});return Math.hypot(p.left-from.left,(p.top-from.top)*2/3)-Math.hypot(q.left-from.left,(q.top-from.top)*2/3);
 })[0]??null;
}
/** Repair crowded legacy layouts on request. Keep every piece if space runs out. */
export function tidyRoomPieces(pieces:readonly RoomPiece[]){
 const placed:RoomPiece[]=[],unplaced:string[]=[];
 for(const p of [...pieces].sort((a,b)=>(a.kind==='decoration'?0:1)-(b.kind==='decoration'?0:1))){
  const preferred=p.surface??'floor';const at=nearestRoomPlacement(p,preferred,placed)??nearestRoomPlacement(p,'floor',placed)??ROOM_SURFACES.flatMap(s=>nearestRoomPlacement(p,s.id,placed)??[])[0];
  if(at)placed.push({...p,free:undefined,...at});else{placed.push({...p});unplaced.push(p.id);}
 }
 const byId=new Map(placed.map(p=>[p.id,p]));return {pieces:pieces.map(p=>byId.get(p.id)!),unplaced};
}
