export interface ArtBounds {x:number;y:number;width:number;height:number}
const cache=new Map<string,ArtBounds>();
/** Measure the visible subject without replacing or changing its source artwork. */
export function roomArtworkBounds(img:HTMLImageElement):ArtBounds{
 const key=img.currentSrc||img.src,cached=cache.get(key);if(cached)return cached;
 const w=img.naturalWidth,h=img.naturalHeight;if(!w||!h)return {x:0,y:0,width:1,height:1};
 let result:ArtBounds={x:0,y:0,width:w,height:h};
 try{
  const ratio=Math.min(1,256/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>24){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(right>=left&&bottom>=top){const pad=1;left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(canvas.width-1,right+pad);bottom=Math.min(canvas.height-1,bottom+pad);result={x:left/canvas.width*w,y:top/canvas.height*h,width:(right-left+1)/canvas.width*w,height:(bottom-top+1)/canvas.height*h};}
 }catch{/* Cross-origin art remains usable with a full-image anchor. */}
 if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;
}
export function anchorRoomArtwork(img:HTMLImageElement){
 const b=roomArtworkBounds(img),scale=100/Math.max(b.width,b.height);
 const properties={position:'absolute',width:`${img.naturalWidth*scale}%`,height:`${img.naturalHeight*scale}%`,left:`${50-(b.x+b.width/2)*scale}%`,top:`${100-(b.y+b.height)*scale}%`,'max-width':'none','max-height':'none','object-fit':'fill',transform:'none'};
 for(const [key,value] of Object.entries(properties))img.style.setProperty(key,value,'important');
}
