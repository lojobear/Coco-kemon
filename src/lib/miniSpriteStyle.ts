/**
 * Small, user-reference-matched Boop sprite postprocessor.
 * The exact source PNG is 112x112; artwork occupies ~44x38 pixels centred
 * near the bottom. Uploaded and cached images DO NOT pass through this path.
 */
export const MINI_CANVAS_SIZE = 112;
export const MINI_FOOTPRINT_WIDTH = 44;
export const MINI_FOOTPRINT_HEIGHT = 38;
export const MINI_FOOTPRINT_CENTER_X = 58;
export const MINI_FOOTPRINT_BOTTOM = 106;
export const MINI_MAX_OPAQUE_COLORS = 8;

type Candidate = { color: [number,number,number]; count: number };
export function alphaBounds(data: Uint8ClampedArray, width: number, height: number) {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(data[(y*width+x)*4+3]<100)continue;
    left=Math.min(left,x);top=Math.min(top,y);
    right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  return right<left ? null : {left,top,right,bottom,width:right-left+1,height:bottom-top+1};
}
function distance(a:readonly number[],b:readonly number[]) {
  // A simple RGB distance keeps source-specific hues rather than a universal palette.
  return 3*(a[0]-b[0])**2+4*(a[1]-b[1])**2+2*(a[2]-b[2])**2;
}
function limitedPalette(data: Uint8ClampedArray): Candidate[] {
  const buckets = new Map<number,{sum:[number,number,number];count:number}>();
  for(let p=0;p<data.length;p+=4){
    if(data[p+3]<100)continue;
    const color:[number,number,number]=[data[p],data[p+1],data[p+2]];
    const key=(color[0]>>5)<<10|(color[1]>>5)<<5|(color[2]>>5);
    const record=buckets.get(key)??{sum:[0,0,0],count:0};
    record.count++;
    for(let j=0;j<3;j++)record.sum[j]+=color[j];
    buckets.set(key,record);
  }
  const selected=[...buckets.values()]
    .sort((a,b)=>b.count-a.count)
    .slice(0,MINI_MAX_OPAQUE_COLORS);
  return selected.map(({sum,count})=>({color:sum.map(value=>Math.round(value/count)) as [number,number,number],count}));
}
/** Fit an existing alpha-masked raster into the exact reference silhouette
 * envelope, using nearest-neighbour sampling and at most 8 solid colors.
 * Operates on pixels only; the browser conversion to PNG lives elsewhere. */
export function composeMiniSpritePixels(
  pixels: Uint8ClampedArray, width: number, height: number,
): Uint8ClampedArray {
  if(width<=0||height<=0||pixels.length!==width*height*4)throw new Error('Invalid sprite pixels');
  const bounds=alphaBounds(pixels,width,height);
  if(!bounds||bounds.width<2||bounds.height<2)throw new Error('Generated sprite has no usable silhouette');
  const scale=Math.min(MINI_FOOTPRINT_WIDTH/bounds.width, MINI_FOOTPRINT_HEIGHT/bounds.height);
  const fitWidth=Math.max(1,Math.min(MINI_FOOTPRINT_WIDTH,Math.round(bounds.width*scale)));
  const fitHeight=Math.max(1,Math.min(MINI_FOOTPRINT_HEIGHT,Math.round(bounds.height*scale)));
  const left=Math.round(MINI_FOOTPRINT_CENTER_X-fitWidth/2);
  const top=MINI_FOOTPRINT_BOTTOM-fitHeight;
  const result=new Uint8ClampedArray(MINI_CANVAS_SIZE*MINI_CANVAS_SIZE*4);
  for(let y=0;y<fitHeight;y++)for(let x=0;x<fitWidth;x++){
    const srcX=Math.min(bounds.right,bounds.left+Math.floor((x+.5)*bounds.width/fitWidth));
    const srcY=Math.min(bounds.bottom,bounds.top+Math.floor((y+.5)*bounds.height/fitHeight));
    const a=(srcY*width+srcX)*4;
    if(pixels[a+3]<100)continue;
    const b=((y+top)*MINI_CANVAS_SIZE+x+left)*4;
    result[b]=pixels[a];result[b+1]=pixels[a+1];result[b+2]=pixels[a+2];result[b+3]=255;
  }
  const palette=limitedPalette(result);
  if(!palette.length)throw new Error('Generated sprite has no visible foreground');
  for(let p=0;p<result.length;p+=4){
    if(result[p+3]===0)continue;
    const source=[result[p],result[p+1],result[p+2]];
    let best=palette[0].color;
    let bestDistance=distance(source,best);
    for(let j=1;j<palette.length;j++){
      const d=distance(source,palette[j].color);
      if(d<bestDistance){best=palette[j].color;bestDistance=d;}
    }
    result[p]=best[0];result[p+1]=best[1];result[p+2]=best[2];
  }
  return result;
}
