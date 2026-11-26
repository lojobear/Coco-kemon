import type { PersonalRoom, RoomAppearance } from './personalRoom';
export const DEFAULT_ROOM_APPEARANCE:RoomAppearance={shell:'classic',wall:'#a8b6ae',floor:'#b9a080',pattern:'planks',lighting:'neutral',fixtures:true,shadows:true};
export function roomAppearance(room:PersonalRoom):RoomAppearance{return room.appearance??DEFAULT_ROOM_APPEARANCE;}
export function roomLightFilter(lighting:RoomAppearance['lighting']):string{
 return lighting==='warm'?'sepia(0.28) saturate(1.14) brightness(1.05)':lighting==='cool'?'sepia(0.12) hue-rotate(15deg) saturate(0.85) brightness(1.04)':lighting==='night'?'brightness(0.65) saturate(0.82) hue-rotate(12deg)':'none';
}
function shade(color:string,factor:number){const safe=/^#[0-9a-f]{6}$/i.test(color)?color:'#a8b6ae';return '#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(safe.slice(i,i+2),16)*factor)).toString(16).padStart(2,'0')).join('');}
export function roomBackdrop(room:PersonalRoom,classic:string):string{
 const a=roomAppearance(room);if(a.shell==='classic')return classic;
 const w=shade(a.wall,1),dark=shade(a.wall,.79),f=shade(a.floor,1),edge=shade(a.floor,.73),line=shade(a.floor,.83);
 const point=(x:number,y:number)=>[50+(x-y)*3.8,54+(x+y)*2.2].join(',');
 const grid=Array.from({length:7},(_,i)=>{const k=i+1;return '<path d="M'+point(k,0)+' L'+point(k,8)+'" />'+(a.pattern==='tiles'?'<path d="M'+point(0,k)+' L'+point(8,k)+'" />':'');}).join('');
 const fixtures=a.fixtures?`<g stroke="#24312f" stroke-width=".4" stroke-linejoin="round">
 <path fill="#ede6d6" d="M25 29.8L33.5 24.8L37 26.7L28.5 31.7Z"/><path fill="#aa9477" d="M28.5 31.7L37 26.7V28L28.5 33Z"/>
 <path fill="#ede6d6" d="M36.5 28L44 32.3L47.3 30.4L39.8 26.1Z"/><path fill="#aa9477" d="M36.5 28V29.4L44 33.7V32.3Z"/>
 <path fill="#72837c" d="M28 54L34.5 50L41 54L34.5 58Z"/><path fill="#50625b" d="M28 54V61L34.5 65V58Z M34.5 58L41 54V61L34.5 65Z"/>
 <path fill="#bfd9d7" fill-opacity=".38" d="M55 45L60.5 42L66 45V53L60.5 56L55 53Z"/><path fill="#5f746f" d="M55 53L60.5 56L66 53V54L60.5 57L55 54Z"/>
 </g>`:'';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
 <defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="#343e42"/><stop offset="1" stop-color="#171f25"/></linearGradient></defs>
 <rect width="100" height="100" fill="url(#bg)"/>
 <ellipse cx="50" cy="86" rx="37" ry="7" fill="#0a1015" opacity=".35"/>
 <path d="M19.6 35.6L50 18L80.4 35.6V71.6L50 54L19.6 71.6Z" fill="${w}"/>
 <path d="M50 18L80.4 35.6V71.6L50 54Z" fill="${dark}"/>
 <path d="M19.6 35.6L50 18L80.4 35.6" fill="none" stroke="#fff" opacity=".24" stroke-width=".5"/>
 <path d="M19.6 69.5L50 51.9L80.4 69.5V71.6L50 54L19.6 71.6Z" fill="${shade(a.wall,.65)}"/>
 <path d="M19.6 71.6L50 89.2L80.4 71.6V74.4L50 92L19.6 74.4Z" fill="${edge}"/>
 <path d="M50 54L80.4 71.6L50 89.2L19.6 71.6Z" fill="${f}" stroke="${edge}" stroke-width=".35"/>
 ${a.pattern==='plain'?'':'<g fill="none" stroke="'+line+'" stroke-width=".26" opacity=".7">'+grid+'</g>'}
 ${fixtures}</svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
