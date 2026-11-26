import {useEffect,useMemo,useRef,useState} from 'react';
import {getElementEmoji} from '../lib/elementEmoji';
import {resolveSpriteSource} from '../lib/spriteAssets';
import {preloadLogoImage} from '../lib/logoArtwork';
import {readCraftElements,SAVE_CHANGED_EVENT,SAVE_IMPORTED_EVENT} from '../lib/saveData';
import {PROFILE_SPRITES_UPDATED} from '../lib/profileSprites';
import {discoveryIdentity} from '../lib/unifiedCollection';
import {LIVE_LOGO_INTERVAL_MS,logoDiscoveries,nextLogoName} from '../lib/liveLogo';

export function LiveSpriteLogo(){
  const [elements,setElements]=useState(readCraftElements);
  const pool=useMemo(()=>logoDiscoveries(elements),[elements]);
  const [display,setDisplay]=useState({id:'',name:'Boop',url:'/icon.svg',source:''});
  const [previousUrl,setPreviousUrl]=useState<string|null>(null);
  const displayRef=useRef(display);displayRef.current=display;
  const revision=useRef(0);
  const loading=useRef(false);
  const [showName,setShowName]=useState(false);
  const host=useRef<HTMLDivElement>(null);
  const latest=useRef({pool,showName});latest.current={pool,showName};
  useEffect(()=>{
    const refresh=()=>setElements([...readCraftElements()]);
    for(const event of [SAVE_CHANGED_EVENT,SAVE_IMPORTED_EVENT,PROFILE_SPRITES_UPDATED])window.addEventListener(event,refresh);
    return()=>{for(const event of [SAVE_CHANGED_EVENT,SAVE_IMPORTED_EVENT,PROFILE_SPRITES_UPDATED])window.removeEventListener(event,refresh);};
  },[]);
  const advance=useRef<()=>void>(()=>undefined);
  advance.current=()=>{
    if(loading.current||document.hidden||latest.current.showName)return;
    const version=revision.current;loading.current=true;
    void (async()=>{
      const candidates=[...latest.current.pool];
      for(let attempt=0;attempt<8&&candidates.length;attempt++){
        const id=nextLogoName(candidates,displayRef.current.id);
        const index=candidates.findIndex(item=>discoveryIdentity(item.name)===id);
        const [item]=candidates.splice(index,1);
        try{
          const source=item.customSpriteUrl||await getElementEmoji(item.name,false,'',false);
          const url=source?await resolveSpriteSource(source):undefined;
          if(!url||!await preloadLogoImage(url))continue;
          if(version!==revision.current||document.hidden||latest.current.showName)return;
          if(displayRef.current.url!==url||displayRef.current.id!==id){
            if(displayRef.current.url!==url)setPreviousUrl(displayRef.current.url);
            setDisplay({id:id!,name:item.name,url,source:item.customSpriteUrl||''});
          }
          return;
        }catch{/* Missing or failed artwork is skipped; the displayed image stays. */}
      }
    })().finally(()=>{if(version===revision.current)loading.current=false;});
  };
  useEffect(()=>{
    revision.current++;loading.current=false;setShowName(false);
    const item=pool.find(item=>discoveryIdentity(item.name)===displayRef.current.id);
    if(!item){
      setPreviousUrl(null);
      setDisplay({id:'',name:'Boop',url:'/icon.svg',source:''});
      advance.current();
    }else if((item.customSpriteUrl||'')!==displayRef.current.source)advance.current();
    return()=>{revision.current++;};
  },[pool]);
  useEffect(()=>{
    const timer=window.setInterval(()=>advance.current(),LIVE_LOGO_INTERVAL_MS);
    return()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>{
    if(!previousUrl)return;
    const timer=window.setTimeout(()=>setPreviousUrl(null),450);
    return()=>window.clearTimeout(timer);
  },[previousUrl,display]);
  useEffect(()=>{
    if(!showName)return;
    const outside=(event:PointerEvent)=>{if(!host.current?.contains(event.target as Node))setShowName(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setShowName(false);};
    const close=()=>setShowName(false);
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);window.addEventListener('boop-native-back',close);
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);window.removeEventListener('boop-native-back',close);};
  },[showName]);
  const name=display.name;
  return <div ref={host} className="boop-live-logo">
    <button type="button" className="boop-live-logo-button" aria-label={`Logo sprite: ${name}. Show name`} aria-expanded={showName} aria-controls="boop-logo-name" onClick={()=>setShowName(value=>!value)}>
      <span className="boop-live-logo-art" aria-hidden="true">
        {previousUrl&&<img className="boop-logo-previous" src={previousUrl} alt=""/>}
        <img key={display.url} className={previousUrl?'boop-logo-ready':''} src={display.url} alt=""/>
      </span>
    </button>
    {showName&&<span id="boop-logo-name" className="boop-logo-name" role="status">{name}</span>}
  </div>;
}
