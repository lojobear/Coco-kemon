/** Resolve and decode artwork before the header ever sees a new image source. */
export function preloadLogoImage(url:string, timeoutMs=8000):Promise<boolean>{
 return new Promise(resolve=>{
  const image=new Image();let finished=false;
  const done=(ready:boolean)=>{if(finished)return;finished=true;clearTimeout(timer);image.onload=null;image.onerror=null;resolve(ready);};
  const timer=setTimeout(()=>done(false),timeoutMs);
  image.onload=()=>{void image.decode().then(()=>done(image.naturalWidth>0)).catch(()=>done(false));};
  image.onerror=()=>done(false);image.src=url;
 });
}
