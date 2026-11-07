/** Compact 112px isometric furni output for newly generated art only.
 * Cached images and user uploads remain untouched. */
export const MINI_CANVAS_SIZE=112;
export const MINI_FOOTPRINT_WIDTH=70;
export const MINI_FOOTPRINT_HEIGHT=70;
export const MINI_FOOTPRINT_CENTER_X=56;
export const MINI_FOOTPRINT_BOTTOM=91;
export const MINI_MAX_OPAQUE_COLORS=40;

export interface AlphaBounds {left:number;top:number;right:number;bottom:number;width:number;height:number}
export function alphaBounds(data: Uint8ClampedArray,width:number,height:number):AlphaBounds|null {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(data[(y*width+x)*4+3]<100)continue;
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  return right<left?null:{left,top,right,bottom,width:right-left+1,height:bottom-top+1};
}
type Cluster={color:[number,number,number];count:number};
type Bucket={data:Cluster[]; min:[number,number,number];max:[number,number,number];total:number};
function box(values:Cluster[]):Bucket{
  const min:[number,number,number]=[255,255,255],max:[number,number,number]=[0,0,0];
  let total=0;
  for(const {color,count} of values) {
    total+=count;
    for(let channel=0;channel<3;channel++){min[channel]=Math.min(min[channel],color[channel]);max[channel]=Math.max(max[channel],color[channel]);}
  }
  return {data:values,min,max,total};
}
function distance(a:readonly number[],b:readonly number[]) {
  return 3*(a[0]-b[0])**2+4*(a[1]-b[1])**2+2*(a[2]-b[2])**2;
}
/** Weighted median cut, not "most common 8 RGB buckets": rare but important
 * colours (eyes, outlines, glowing accents) get their own palette regions.
 * A genuinely 8-colour hand-drawn subject retains those 8 exact colours. */
function spritePalette(data:Uint8ClampedArray):number[][] {
  const histogram=new Map<number,Cluster>();
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<100)continue;
    const key=(data[i]<<16)|(data[i+1]<<8)|data[i+2];
    const previous=histogram.get(key);
    if(previous)previous.count++;
    else histogram.set(key,{color:[data[i],data[i+1],data[i+2]],count:1});
  }
  if(!histogram.size)return [];
  let boxes=[box([...histogram.values()])];
  while(boxes.length<MINI_MAX_OPAQUE_COLORS){
    let selected=-1,score=0;
    for(let i=0;i<boxes.length;i++){
      const b=boxes[i],spread=Math.max(...b.max.map((v,k)=>v-b.min[k]));
      const weight=spread*Math.sqrt(b.total);
      if(b.data.length>1&&weight>score){selected=i;score=weight;}
    }
    if(selected<0)break;
    const current=boxes[selected];
    const channel=current.max.map((v,k)=>v-current.min[k])
      .reduce((best,v,i,all)=>v>all[best]?i:best,0);
    const entries=[...current.data].sort((a,b)=>a.color[channel]-b.color[channel]);
    let sum=0,split=0;
    while(split<entries.length-1&&sum<current.total/2)sum+=entries[split++].count;
    if(split<1||split>=entries.length)break;
    boxes.splice(selected,1,box(entries.slice(0,split)),box(entries.slice(split)));
  }
  return boxes.map(b=>{
    const sum=[0,0,0];
    for(const {color,count} of b.data)for(let c=0;c<3;c++)sum[c]+=color[c]*count;
    return sum.map(n=>Math.round(n/b.total));
  });
}
/** Reframe generated art to occupy the centre, preserve clear outlines and
 * reduce smooth image-model palettes to distinct handheld-style clusters.
 * No AI calls; the source raster is read only. */
export function composeMiniSpritePixels(pixels:Uint8ClampedArray,width:number,height:number):Uint8ClampedArray{
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||pixels.length!==width*height*4)
    throw new Error('Invalid sprite pixels');
  const bounds=alphaBounds(pixels,width,height);
  if(!bounds||bounds.width<2||bounds.height<2)throw new Error('Generated sprite has no usable silhouette');
  const fit=Math.min(MINI_FOOTPRINT_WIDTH/bounds.width,MINI_FOOTPRINT_HEIGHT/bounds.height);
  const w=Math.max(1,Math.min(MINI_FOOTPRINT_WIDTH,Math.round(bounds.width*fit)));
  const h=Math.max(1,Math.min(MINI_FOOTPRINT_HEIGHT,Math.round(bounds.height*fit)));
  const left=Math.max(0,Math.round(MINI_FOOTPRINT_CENTER_X-w/2));
  const top=MINI_FOOTPRINT_BOTTOM-h;
  const output=new Uint8ClampedArray(MINI_CANVAS_SIZE*MINI_CANVAS_SIZE*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const srcX=Math.min(bounds.right,bounds.left+Math.floor((x+.5)*bounds.width/w));
    const srcY=Math.min(bounds.bottom,bounds.top+Math.floor((y+.5)*bounds.height/h));
    const a=(srcY*width+srcX)*4;
    if(pixels[a+3]<100)continue;
    const b=((top+y)*MINI_CANVAS_SIZE+left+x)*4;
    output[b]=pixels[a];output[b+1]=pixels[a+1];output[b+2]=pixels[a+2];output[b+3]=255;
  }
  const palette=spritePalette(output);
  if(!palette.length)throw new Error('Generated sprite has no visible foreground');
  for(let i=0;i<output.length;i+=4) {
    if(output[i+3]===0)continue;
    const original=[output[i],output[i+1],output[i+2]];
    let chosen=palette[0],best=distance(original,chosen);
    for(let j=1;j<palette.length;j++){
      const d=distance(original,palette[j]);
      if(d<best){chosen=palette[j];best=d;}
    }
    output[i]=chosen[0];output[i+1]=chosen[1];output[i+2]=chosen[2];
  }
  return output;
}
