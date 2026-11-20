import { BUILT_IN_PAIR_RECIPES } from './builtInPairs';
import { discoveryIdentity } from './unifiedCollection';
import { isSuppliedStarter } from './starterIdentity';
import type { InfiniteElement } from './infiniteCraftData';
/** Only verified, currently craftable recipes are suggested. Existing boards are never replaced. */
export function nextRoomDiscovery(owned:readonly InfiniteElement[],target?:string){
 const names=new Set(owned.map(e=>discoveryIdentity(e.name)));
 const candidates=Object.entries(BUILT_IN_PAIR_RECIPES).flatMap(([key,result])=>{
  const [first,second]=key.split(':::');if(!names.has(first)||!names.has(second)||names.has(discoveryIdentity(result.result)))return [];
  const a=owned.find(e=>discoveryIdentity(e.name)===first)!,b=owned.find(e=>discoveryIdentity(e.name)===second)!;
  return [{first:a.name,second:b.name,result:result.result}];
 });
 return candidates.find(c=>target&&discoveryIdentity(c.result)===discoveryIdentity(target))??candidates.find(c=>c.result==='Steam')??candidates[0]??null;
}
export const ROOM_DISCOVERY_REQUEST='boop-room-discovery-request';
export const ROOM_DISPLAY_REQUEST='boop-room-display-request';
export function recentRoomFinds(owned:readonly InfiniteElement[]){
 return owned.filter(e=>!isSuppliedStarter(e)).sort((a,b)=>(b.discoveredAt||b.firstCraftedAt||0)-(a.discoveredAt||a.firstCraftedAt||0)).slice(0,4);
}
