import { memo, useEffect, useRef } from 'react';
import { CraftSprite } from './CraftSprite';
import { anchorRoomArtwork } from '../lib/roomArtwork';
import type { CollectorVariant } from '../lib/collectorData';
export const RoomArtwork=memo(function RoomArtwork({name,emoji,kind,variant,animateStarter=false}:{name:string;emoji:string;kind:'sprite'|'decoration';variant:CollectorVariant;animateStarter?:boolean}){
 const host=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const frame=host.current;if(!frame)return;
  const update=()=>{const img=frame.querySelector('img');if(img?.complete&&img.naturalWidth)anchorRoomArtwork(img);};
  const observer=new MutationObserver(update);observer.observe(frame,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});update();return()=>observer.disconnect();
 },[name,variant]);
 return <span ref={host} className="room-art-frame" onLoadCapture={e=>{const target=e.target;if(target instanceof HTMLImageElement)anchorRoomArtwork(target);}}>{kind==='sprite'?<CraftSprite name={name} emoji={emoji} idle={false} isShiny={variant==='shiny'} animateStarter={animateStarter}/>:<img src={`/room/${name}.png`} alt="" draggable={false}/>}</span>;
});
