import { discoveryIdentity } from '../lib/unifiedCollection';
import { memo, useEffect, useRef, useState } from 'react';
import { Gift, PackageCheck, X, Star } from 'lucide-react';
import { commitOrderAction, readEconomy, readCraftElements, SAVE_CHANGED_EVENT, SAVE_IMPORTED_EVENT, SAVE_STATUS_EVENT } from '../lib/saveData';
import { availableCopies, type Economy } from '../lib/economy';
import { activeOrders, orderGuide, orderMatches, orderReward, type BoopOrder } from '../lib/boopOrders';
import { DECORATIONS, emptyOrderProgress, orderReputation } from '../lib/orderProgress';
import type { InfiniteElement } from '../lib/infiniteCraftData';
interface Snapshot {wallet:Economy;collection:InfiniteElement[]}
const snapshot=():Snapshot=>({wallet:readEconomy(),collection:readCraftElements()});
export function useOrderSnapshot(){
 const [state,setState]=useState(snapshot);
 useEffect(()=>{const refresh=()=>setState(snapshot());for(const event of [SAVE_CHANGED_EVENT,SAVE_IMPORTED_EVENT,SAVE_STATUS_EVENT])window.addEventListener(event,refresh);refresh();return()=>{for(const event of [SAVE_CHANGED_EVENT,SAVE_IMPORTED_EVENT,SAVE_STATUS_EVENT])window.removeEventListener(event,refresh);};},[]);
 return state;
}
function OrderCard({order,state,busy,onDeliver}:{key?:string;order:BoopOrder;state:Snapshot;busy:boolean;onDeliver:(ticket:string,name:string)=>void}){
 const matches=state.collection.filter(item=>orderMatches(order,item));
 const [selected,setSelected]=useState(()=>order.accepts.find(name=>matches.some(item=>discoveryIdentity(item.name)===discoveryIdentity(name)&&availableCopies(item,state.wallet,'normal')>0))??order.accepts[0]);
 const item=matches.find(item=>discoveryIdentity(item.name)===discoveryIdentity(selected));
 const copies=item?availableCopies(item,state.wallet,'normal'):0;
 return <article className="boop-order-card">
  <header><span className="boop-order-customer" aria-hidden="true">{order.emoji}</span><div><small>{order.difficulty} · +{order.reputation} reputation</small><h3>{order.customer}</h3></div></header>
  <p>“{order.request}”</p>
  <label>Choose one discovery<select aria-label={`Delivery for ${order.customer}`} value={selected} onChange={event=>setSelected(event.target.value)} disabled={busy}>{order.accepts.map(name=>{const owned=matches.find(item=>discoveryIdentity(item.name)===discoveryIdentity(name));return <option key={name} value={name}>{name} · {owned?availableCopies(owned,state.wallet,'normal'):0} normal copies</option>;})}</select></label>
  <div className="boop-order-reward">{item?`${orderReward(order,item,state.collection).toLocaleString()} coins`:`Item value + ${order.bonus} coins`}<small>Uses 1 normal crafted copy</small></div>
  <button type="button" className="boop-feature-primary boop-order-deliver" disabled={busy||copies<1} onClick={()=>onDeliver(order.ticket,selected)}><PackageCheck size={17}/>{copies>0?'Deliver copy':'Craft a normal copy to deliver'}</button>
  <details><summary>Recipe clue</summary><p>Use Mix. Your discovery stays collected after delivery.</p><ol>{orderGuide(selected).map(step=><li key={step.result}>{step.first} + {step.second} → <strong>{step.result}</strong></li>)}</ol></details>
 </article>;
}
export const BoopOrders=memo(function BoopOrders({state,blocked=false}:{state:Snapshot;blocked?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const back=()=>{if(!busy)dialog.current?.close();};window.addEventListener('boop-native-back',back);return()=>window.removeEventListener('boop-native-back',back);},[busy]);
 const progress=state.wallet.orders??emptyOrderProgress(),orders=activeOrders(progress),reputation=orderReputation(progress);
 const ready=orders.filter(order=>state.collection.some(item=>orderMatches(order,item)&&availableCopies(item,state.wallet,'normal')>0)).length;
 const next=DECORATIONS.find(decoration=>decoration.reputation>reputation);
 const change=async(action:Parameters<typeof commitOrderAction>[0])=>{
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const result=await commitOrderAction(action);
   if('reward' in result){
    setMessage(`Delivered ${result.item}: +${result.reward.toLocaleString()} coins, +${result.order.reputation} reputation.${result.unlocked.length?' Unlocked '+result.unlocked.map(d=>d.name).join(', ')+'.':''} A new order is ready.`);
    dialog.current?.scrollTo({top:0});
   }else setMessage('Board decoration equipped.');
  }
  catch(error){setError(error instanceof Error?error.message:'Your order could not be saved. Please retry.');}
  finally{setBusy(false);}
 };
 return <div className="boop-orders-entry">
  <button type="button" className="boop-orders-trigger" aria-label={`Boop Orders, ${ready} ready to deliver, ${reputation} reputation`} aria-haspopup="dialog" disabled={blocked} onClick={()=>dialog.current?.showModal()}><Gift size={18}/><strong>Orders</strong><span className="boop-orders-mobile-count" aria-hidden="true">{ready||''}</span><span>{ready?`${ready} ready to deliver`:'3 requests waiting'}</span><span className="boop-orders-reputation"><Star size={14}/>{reputation}</span></button>
  <dialog ref={dialog} className="boop-orders-dialog" aria-labelledby="boop-orders-title" onCancel={event=>{if(busy)event.preventDefault();}}>
   <header className="boop-orders-heading"><div><h2 id="boop-orders-title">Boop Orders</h2><p>Craft, deliver, earn. No deadlines—your customers will wait.</p></div><button type="button" disabled={busy} autoFocus aria-label="Close Boop Orders" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
   <div className="boop-orders-balance"><span>★ {reputation} reputation</span><span>{state.wallet.coins.toLocaleString()} Boop Coins</span></div>
   <p className="boop-orders-explainer">Deliver one normal crafted copy. Keep the discovery and its artwork. Shiny and other special copies are protected.</p>
   {message&&<p role="status" className="boop-orders-success">{message}</p>}{error&&<p role="alert">{error}</p>}
   <div className="boop-orders-grid">{orders.map(order=><OrderCard key={order.ticket} order={order} state={state} busy={busy||blocked} onDeliver={(ticket,name)=>void change({ticket,name})}/>)}</div>
   <section className="boop-orders-cosmetics" aria-label="Order reputation rewards"><h3>Make your board yours</h3><p>{next?`${next.name} unlocks at ${next.reputation} reputation. You have ${reputation}.`:'All board decorations unlocked. Keep delivering to grow your reputation.'}</p><div>{DECORATIONS.map(decoration=><button type="button" key={decoration.id} disabled={busy||blocked||reputation<decoration.reputation} aria-pressed={progress.decoration===decoration.id} onClick={()=>void change({decoration:decoration.id})}>{decoration.name}{reputation<decoration.reputation?` · ${decoration.reputation} rep`:progress.decoration===decoration.id?' · Equipped':''}</button>)}</div></section>
  </dialog>
 </div>;
});
