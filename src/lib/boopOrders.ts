import type { InfiniteElement } from './infiniteCraftData';
import type { Economy } from './economy';
import { availableCopies, validEconomy } from './economy';
import { elementValue, buildCollectionValueBook } from './elementValue';
import { discoveryIdentity } from './unifiedCollection';
import { DISCOVERY_TRAILS, type TrailStep } from './discoveryTrails';
import { DECORATIONS, emptyOrderProgress, orderReputation, type Decoration, type OrderProgress } from './orderProgress';
interface Request {id:string;customer:string;emoji:string;request:string;accepts:string[]}
const POOLS:Request[][]=[
 [
  {id:'warm-cloud',customer:'Sleepy astronaut',emoji:'🧑‍🚀',request:'A little warmth for my chilly space cabin.',accepts:['Steam','Lava']},
  {id:'tiny-lake',customer:'Pond keeper',emoji:'🐸',request:'A new place for my tadpoles to swim.',accepts:['Lake','Ocean']},
  {id:'sky-painter',customer:'Sky painter',emoji:'🎨',request:'Something soft to paint across the sky.',accepts:['Cloud','Steam']},
  {id:'stone-mason',customer:'Pocket architect',emoji:'🏗️',request:'A sturdy foundation for my tiny tower.',accepts:['Stone']},
 ],
 [
  {id:'window-maker',customer:'Glassblower',emoji:'🏺',request:'I need material for a new window.',accepts:['Sand','Glass']},
  {id:'storm-study',customer:'Weather watcher',emoji:'🧙',request:'Something stormy for my weather collection.',accepts:['Thunderstorm','Thunder Egg']},
  {id:'night-light',customer:'Deep-sea diver',emoji:'🤿',request:'A gentle light for the ocean at night.',accepts:['Sea Lantern','Moon Jelly']},
 ],
 [
  {id:'storm-friend',customer:'Storm ranger',emoji:'🦉',request:'Find me a feathered friend born from a storm.',accepts:['Storm Wren']},
  {id:'prism-pond',customer:'Prism collector',emoji:'🦋',request:'A living discovery with a glassy shimmer.',accepts:['Glasswing','Prism Koi']},
  {id:'moon-garden',customer:'Moon gardener',emoji:'🐇',request:'Help me plant a little moonlight.',accepts:['Lunar Garden']},
 ],
];
export interface BoopOrder extends Request {slot:number;ticket:string;difficulty:string;bonus:number;reputation:number}
export function activeOrders(progress:OrderProgress=emptyOrderProgress()):BoopOrder[]{
 return POOLS.map((pool,slot)=>{const cycle=progress.cycles[slot],request=pool[cycle%pool.length];return {...request,slot,ticket:`${slot}:${cycle}:${request.id}`,difficulty:['Easy','Explore','Adventure'][slot],bonus:[120,300,700][slot],reputation:slot+1};});
}
export function orderGuide(name:string):TrailStep[]{
 for(const trail of DISCOVERY_TRAILS){const index=trail.steps.findIndex(step=>discoveryIdentity(step.result)===discoveryIdentity(name));if(index>=0)return trail.steps.slice(0,index+1);}
 return [];
}
export function orderMatches(order:BoopOrder,item:InfiniteElement){return order.accepts.some(name=>discoveryIdentity(name)===discoveryIdentity(item.name));}
export function orderReward(order:BoopOrder,item:InfiniteElement,collection:readonly InfiniteElement[]){return elementValue(item,'normal',buildCollectionValueBook(collection)).coins+order.bonus;}
/** One transaction consumes only a normal earned copy; discoveries, artwork and sale receipts stay intact. */
export function applyOrderDelivery(economy:Economy,collection:readonly InfiniteElement[],ticket:string,name:string){
 if(!validEconomy(economy))throw new Error('Invalid wallet.');
 const progress=economy.orders??emptyOrderProgress();
 const order=activeOrders(progress).find(order=>order.ticket===ticket);
 if(!order)throw new Error('This order has already changed. Choose the current request.');
 const item=collection.find(item=>discoveryIdentity(item.name)===discoveryIdentity(name));
 if(!item||!orderMatches(order,item))throw new Error('That discovery does not match this order.');
 if(availableCopies(item,economy,'normal')<1)throw new Error('Craft another normal copy before delivering. Your discovery stays in your collection.');
 const reward=orderReward(order,item,collection);
 if(!Number.isSafeInteger(economy.coins+reward))throw new Error('Wallet limit reached.');
 const key=discoveryIdentity(item.name),delivered=(Object.hasOwn(progress.delivered,key)?progress.delivered[key]:0)+1;
 const cycles=[...progress.cycles] as OrderProgress['cycles'];cycles[order.slot]++;
 const orders:OrderProgress={...progress,cycles,delivered:{...progress.delivered,[key]:delivered}};
 if(!validEconomy({...economy,orders}))throw new Error('Order progress limit reached.');
 return {economy:{...economy,coins:economy.coins+reward,orders},reward,order,item:item.name,
  unlocked:DECORATIONS.filter(d=>d.reputation>orderReputation(progress)&&d.reputation<=orderReputation(orders))};
}
export function applyBoardDecoration(economy:Economy,decoration:Decoration):Economy {
 if(!validEconomy(economy))throw new Error('Invalid wallet.');
 const progress=economy.orders??emptyOrderProgress();
 if(!DECORATIONS.some(d=>d.id===decoration&&d.reputation<=orderReputation(progress)))throw new Error('Earn more reputation to unlock this board decoration.');
 return {...economy,orders:{...progress,decoration}};
}
