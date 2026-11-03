import type { InfiniteElement } from './infiniteCraftData';
import type { TrophyRoom } from './collectorData';
import { getCachedElementSprite } from './elementEmoji';

/** On-device PNG exporter: a shareable trophy room, no backend or API quota. */
export async function exportTrophyPostcard(room: TrophyRoom, elements: readonly InfiniteElement[]): Promise<Blob> {
  const canvas=document.createElement('canvas');
  canvas.width=1200;canvas.height=1000;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Image export is not available on this device.');
  const bg=room.theme==='night'?'#192031':room.theme==='studio'?'#eaf2ef':'#fbfaf5';
  const ink=room.theme==='night'?'#ffffff':'#252b32';
  ctx.fillStyle=bg;ctx.fillRect(0,0,1200,1000);
  ctx.fillStyle=ink;ctx.textAlign='center';
  ctx.font='bold 54px system-ui,sans-serif';ctx.fillText('MY BOOP COLLECTION',600,90);
  ctx.font='25px system-ui,sans-serif';ctx.fillText('A room of impossible little discoveries',600,128);
  const owned=new Map(elements.map(e=>[e.name.toLowerCase(),e]));
  for(let i=0;i<room.slots.length;i++){
    const tile=room.slots[i];
    const x=55+(i%4)*289,y=160+Math.floor(i/4)*245;
    const dark=room.theme==='night';
    ctx.fillStyle=dark?'#30394c':'#ffffff';ctx.fillRect(x,y,269,226);
    ctx.strokeStyle=tile?.frame==='gold'?'#d4a85b':tile?.frame==='holo'?'#ac93d8':dark?'#535c70':'#dfe4e6';
    ctx.lineWidth=5;ctx.strokeRect(x+2,y+2,265,222);
    if(!tile) {
      ctx.fillStyle=dark?'#778194':'#c0c7cf';
      ctx.font='48px system-ui,sans-serif';ctx.fillText('＋',x+134,y+120);
      continue;
    }
    const element=owned.get(tile.name.toLowerCase());
    if(!element)continue;
    let imageRendered=false;
    try {
      const src=await getCachedElementSprite(element.name,tile.variant==='shiny');
      if(src) {
        const image=new Image();
        image.src=src;
        await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Image unavailable'));});
        ctx.save();
        if(tile.variant==='celestial')ctx.filter='sepia(1) saturate(2.6) hue-rotate(193deg) brightness(1.16)';
        ctx.imageSmoothingEnabled=false;ctx.drawImage(image,x+64,y+20,140,140);
        ctx.restore();imageRendered=true;
      }
    }catch { /* Show collectible emoji if its artwork is unavailable. */ }
    if(!imageRendered){ctx.font='87px system-ui,sans-serif';ctx.fillText(element.emoji||'✨',x+134,y+133);}
    if(tile.variant!=='normal'){ctx.font='28px system-ui,sans-serif';ctx.fillText(tile.variant==='celestial'?'✶':'✦',x+238,y+40);}
    ctx.font='bold 19px system-ui,sans-serif';ctx.fillStyle=ink;
    const label=element.name.length>22?element.name.slice(0,21)+'…':element.name;
    ctx.fillText(label,x+134,y+196);
  }
  ctx.fillStyle=ink;ctx.font='21px system-ui,sans-serif';
  ctx.fillText('Made in Boop · Collected by curiosity',600,959);
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not export gallery.')),'image/png'));
}
