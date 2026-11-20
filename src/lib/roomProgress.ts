import type { InfiniteElement } from './infiniteCraftData';
import { isSuppliedStarter } from './starterIdentity';
import { discoveryIdentity } from './unifiedCollection';
export const ROOM_STYLES = [
 {id:'moonlit',name:'Moonlit nook',description:'Warm lamplight, violet walls and a starry sky.',image:'/room/moonlit-room.png',discoveries:0},
 {id:'sunlit',name:'Sunlit conservatory',description:'Sage walls, golden sunlight and a garden view.',image:'/room/sunlit-room.png',discoveries:5},
 {id:'orbital',name:'Orbital observatory',description:'Deep teal, brass details and a nebula beyond the window.',image:'/room/orbital-room.png',discoveries:15},
] as const;
export type RoomStyle=typeof ROOM_STYLES[number]['id'];
export const ROOM_REWARDS = [
 {id:'display-stand',name:'Display stand',reputation:0,discoveries:0,concept:'',width:10,footprint:5.5,surfaces:['floor']},
 {id:'fern',name:'Potted fern',reputation:9,discoveries:3,concept:'Tree',width:8,footprint:4.5,surfaces:['floor','left-shelf','right-shelf','desk']},
 {id:'orbit-lamp',name:'Orbit lamp',reputation:18,discoveries:15,concept:'',width:9,footprint:4.5,surfaces:['floor','left-shelf','right-shelf','desk']},
 {id:'terrarium',name:'Glass terrarium',reputation:null,discoveries:5,concept:'Tree',width:10,footprint:5.5,surfaces:['floor','left-shelf','right-shelf','display','desk']},
 {id:'aquarium',name:'Mini aquarium',reputation:null,discoveries:12,concept:'Ocean',width:12,footprint:7,surfaces:['floor','desk']},
 {id:'crystal-cluster',name:'Crystal centerpiece',reputation:null,discoveries:20,concept:'Crystal',width:9,footprint:5,surfaces:['floor','left-shelf','right-shelf','display','desk']},
] as const;
export type RoomDecoration=typeof ROOM_REWARDS[number]['id'];
export function roomDiscoveryProgress(owned:readonly InfiniteElement[]){
 const discoveries=Array.from(new Map(owned.filter(e=>!isSuppliedStarter(e)&&!['water','fire','wind','earth'].includes(discoveryIdentity(e.name))).map(e=>[discoveryIdentity(e.name),e])).values());
 return {count:discoveries.length,names:new Set(discoveries.map(e=>discoveryIdentity(e.name)))};
}
export function roomRewardUnlocked(reward:typeof ROOM_REWARDS[number],owned:readonly InfiniteElement[],reputation:number){
 const p=roomDiscoveryProgress(owned);
 return p.count>=reward.discoveries||(!!reward.concept&&p.names.has(discoveryIdentity(reward.concept)))||(reward.reputation!==null&&reputation>=reward.reputation);
}
export function roomRewardHint(reward:typeof ROOM_REWARDS[number]){
 if(reward.discoveries===0)return 'Ready to place';
 return `${reward.discoveries} discoveries${reward.concept?` or discover ${reward.concept}`:''}${reward.reputation!==null?` or ${reward.reputation} reputation`:''}`;
}
