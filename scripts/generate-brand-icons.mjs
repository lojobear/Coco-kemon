/** Offline, dependency-free PNG companions to public/icon.svg.
 *  Keeps Boop's installed icons white/charcoal even on PWA clients that prefer PNG. */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const folder = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const charcoal = [36,42,49,255], white=[255,255,255,255];
const light=[212,219,226,255], mid=[195,204,213,255], orbit=[191,199,209,255];
const dist=(x,y,a,b,c,d)=>{const dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-(a+t*dx),y-(b+t*dy));};
function curveDistance(x,y,p0,p1,p2){let nearest=1e6,prev=p0;for(let i=1;i<=36;i++){const t=i/36,u=1-t,p=[u*u*p0[0]+2*u*t*p1[0]+t*t*p2[0],u*u*p0[1]+2*u*t*p1[1]+t*t*p2[1]];nearest=Math.min(nearest,dist(x,y,...prev,...p));prev=p;}return nearest;}
function polygon(x,y,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function colorAt(x,y){
  const corner=Math.min(x,64-x),edge=Math.min(y,64-y);
  if(corner<14&&edge<14&&Math.hypot(corner-14,edge-14)>14)return [0,0,0,0];
  let c=charcoal;
  if(curveDistance(x,y,[9,41],[31,20],[58,29])<1.8)c=orbit;
  if(Math.hypot(x-32,y-33)<16.5)c=white;
  if(polygon(x,y,[[21,29],[26,24],[33,25],[35,30],[30,35],[23,34]]))c=light;
  if(polygon(x,y,[[35,37],[40,33],[47,35],[45,42],[39,47],[34,44]]))c=mid;
  if(dist(x,y,30,17,30,12)<1.15)c=white;
  if(polygon(x,y,[[30,13],[26,12],[23,9],[23,6],[27,7],[30,10]]))c=white;
  if(polygon(x,y,[[31,12],[32,8],[36,5],[39,5],[37,10],[34,12]]))c=white;
  if(curveDistance(x,y,[10,42],[35,52],[59,33])<1.9)c=white;
  if(curveDistance(x,y,[10,42],[35,52],[59,33])<.65)c=mid;
  if(dist(x,y,14,16,14,23)<1||dist(x,y,10.5,19.5,17.5,19.5)<1)c=white;
  if(dist(x,y,52,13,52,19)<1||dist(x,y,49,16,55,16)<1)c=white;
  if(Math.hypot(x-48,y-50)<1.4)c=white;
  return c;
}
function crc32(bytes){let crc=-1;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^-1)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([len,tag,data,crc]);}
function encodePNG(n,maskable=false){
  const rows=Buffer.alloc(n*(1+n*4));
  for(let py=0;py<n;py++){let pos=py*(1+n*4);rows[pos++]=0;
    for(let px=0;px<n;px++){
      // 96-grid sampling is intentional: this is a pixel-art collectible logo.
      let x=(Math.floor(px/n*96)+.5)/96*64,y=(Math.floor(py/n*96)+.5)/96*64;
      if(maskable){x=(x-32)/.78+32;y=(y-32)/.78+32;}
      const c=(maskable&&(x<0||x>=64||y<0||y>=64))?charcoal:colorAt(x,y);
      for(let k=0;k<4;k++)rows[pos++]=maskable&&c[3]===0?charcoal[k]:c[k];
    }
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(n,0);header.writeUInt32BE(n,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
for(const [name,size,maskable] of [['pwa-192x192.png',192,false],['pwa-512x512.png',512,false],['pwa-maskable-512x512.png',512,true],['apple-touch-icon.png',180,false]]){
  writeFileSync(resolve(folder,name),encodePNG(size,maskable));
}
