import {useEffect,useMemo,useRef,useState} from 'react';
import {ElementSprite} from './ElementSprite';
import {readCraftElements,SAVE_CHANGED_EVENT,SAVE_IMPORTED_EVENT} from '../lib/saveData';
import {PROFILE_SPRITES_UPDATED} from '../lib/profileSprites';
import {discoveryIdentity} from '../lib/unifiedCollection';
import {LIVE_LOGO_INTERVAL_MS,logoDiscoveries,nextLogoName} from '../lib/liveLogo';

export function LiveSpriteLogo(){
  const [elements,setElements]=useState(readCraftElements);
  const pool=useMemo(()=>logoDiscoveries(elements),[elements]);
  const [current,setCurrent]=useState<string|null>(()=>nextLogoName(logoDiscoveries(readCraftElements()),null));
  const [showName,setShowName]=useState(false);
  const host=useRef<HTMLDivElement>(null);
  const latest=useRef({pool,showName});latest.current={pool,showName};
  useEffect(()=>{
    const refresh=()=>setElements([...readCraftElements()]);
    for(const event of [SAVE_CHANGED_EVENT,SAVE_IMPORTED_EVENT,PROFILE_SPRITES_UPDATED])window.addEventListener(event,refresh);
    return()=>{for(const event of [SAVE_CHANGED_EVENT,SAVE_IMPORTED_EVENT,PROFILE_SPRITES_UPDATED])window.removeEventListener(event,refresh);};
  },[]);
  useEffect(()=>{
    setCurrent(previous=>pool.some(item=>discoveryIdentity(item.name)===previous)?previous:nextLogoName(pool,previous));
    setShowName(false);
  },[pool]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{
      if(document.hidden||latest.current.showName)return;
      setCurrent(previous=>nextLogoName(latest.current.pool,previous));
    },LIVE_LOGO_INTERVAL_MS);
    return()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>{
    if(!showName)return;
    const outside=(event:PointerEvent)=>{if(!host.current?.contains(event.target as Node))setShowName(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setShowName(false);};
    const close=()=>setShowName(false);
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);window.addEventListener('boop-native-back',close);
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);window.removeEventListener('boop-native-back',close);};
  },[showName]);
  const element=pool.find(item=>discoveryIdentity(item.name)===current);
  const name=element?.name||'Boop';
  return <div ref={host} className="boop-live-logo">
    <button type="button" className="boop-live-logo-button" aria-label={`Logo sprite: ${name}. Show name`} aria-expanded={showName} aria-controls="boop-logo-name" onClick={()=>setShowName(value=>!value)}>
      <span key={current||'boop'} className="boop-live-logo-art" aria-hidden="true">{element
        ? <ElementSprite name={element.name} custom={element.customSpriteUrl} fallback={element.emoji} category={element.category} isShiny={element.isShiny} idle={false}/>
        : <img src="/toybox/boop-planet.png" alt=""/>}</span>
    </button>
    {showName&&<span id="boop-logo-name" className="boop-logo-name" role="status">{name}</span>}
  </div>;
}
