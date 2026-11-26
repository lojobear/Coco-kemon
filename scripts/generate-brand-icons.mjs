/** Offline, dependency-free PNG companions to public/icon.svg.
 *  Keeps Boop's installed icons white/charcoal even on PWA clients that prefer PNG. */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const folder = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const charcoal=[32,35,35,255], white=[255,255,255,255];
// Sample the very same Bezier contours used in public/icon.svg.
function outline(start,curves){
  const points=[start];let a=start;
  for(const [b,c,d] of curves){for(let i=1;i<=32;i++){const t=i/32,u=1-t;points.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]);}a=d;}return points;
}
const outer=outline([167,48],[[[158,40],[145,36],[131,36]],[[107,36],[90,53],[90,77]],[[90,101],[107,118],[131,118]],[[145,118],[158,114],[167,106]],[[176,114],[189,118],[203,118]],[[227,118],[244,101],[244,77]],[[244,53],[227,36],[203,36]],[[189,36],[176,40],[167,48]]]);
const spark=[[167,63]];let a=spark[0];for(const [b,c] of [[[169,75],[179,77]],[[169,79],[167,91]],[[165,79],[155,77]],[[165,75],[167,63]]]){for(let i=1;i<=24;i++){const t=i/24,u=1-t;spark.push([u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]);}a=c;}
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function colorAt(x,y){
  const corner=Math.min(x,64-x),edge=Math.min(y,64-y);
  if(corner<15.5&&edge<15.5&&Math.hypot(corner-15.5,edge-15.5)>15.5)return [0,0,0,0];
  const sx=(x+13.25)/.271,sy=(y-11.13)/.271;
  if(sx<90||sx>244||sy<36||sy>118)return charcoal;
  return inside(sx,sy,outer)&&Math.hypot(sx-131,sy-77)>=17&&Math.hypot(sx-203,sy-77)>=17&&!inside(sx,sy,spark)?white:charcoal;
}
function crc32(bytes){let crc=-1;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^-1)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([len,tag,data,crc]);}
function encodePNG(n,maskable=false){
  const rows=Buffer.alloc(n*(1+n*4));
  for(let py=0;py<n;py++){let pos=py*(1+n*4);rows[pos++]=0;
    for(let px=0;px<n;px++){
      // Sample at the output pixel centers for smooth scalable branding.
      let x=(px+.5)/n*64,y=(py+.5)/n*64;
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
