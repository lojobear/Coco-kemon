import {clampBoardTile} from './boardGeometry';
export interface PinnedTile {instanceId:string;x:number;y:number;pinned?:boolean}
export function withoutUnpinnedInputs<T extends PinnedTile>(items:readonly T[],ids:readonly string[]):T[]{
 const used=new Set(ids);return items.filter(item=>item.pinned||!used.has(item.instanceId));
}
/** Leave the anchored ingredient uncovered when it is reused in a recipe. */
export function pinnedResultPosition(preferred:{x:number;y:number},remaining:readonly PinnedTile[]){
 const pins=remaining.filter(item=>item.pinned);
 if(!pins.length)return clampBoardTile(preferred.x,preferred.y);
 const nearby=[preferred,...pins.flatMap(pin=>[{x:pin.x+170,y:pin.y},{x:pin.x-170,y:pin.y},{x:pin.x,y:pin.y+160},{x:pin.x,y:pin.y-160}])]
  .map(point=>clampBoardTile(point.x,point.y))
  .sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
 const open=nearby.find(point=>pins.every(pin=>Math.abs(pin.x-point.x)>=160||Math.abs(pin.y-point.y)>=140));
 if(open)return open;
 for(let row=0;row<25;row++)for(const dx of [0,170,-170,340,-340]){
  const point=clampBoardTile(preferred.x+dx,preferred.y+row*160);
  if(pins.every(pin=>Math.abs(pin.x-point.x)>=160||Math.abs(pin.y-point.y)>=140))return point;
 }
 return clampBoardTile(preferred.x,preferred.y+160);
}
