/**
 * Local-only quota fallback. The exported/cloud save remains ordinary v3 JSON.
 * Repeated PNGs across Craft and Foundry are stored once, and each pair of
 * base64 characters occupies one safe UTF-16 code unit. No image resampling,
 * network calls, loss of pixels, or modifications to the logical envelope.
 * Version 4 is reserved here for this explicitly tagged local representation;
 * older builds refuse to overwrite it. Never accept it as a cloud backup.
 */
export const PACKED_LOCAL_VERSION=4;
const ENCODING='boop-png-dictionary-v1';
const BASE64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const PNG='data:image/png;base64,';
const PACK_OFFSET=0x100;
const isPng=(value:unknown):value is string=>typeof value==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
function packPng(value:string):string{
 const data=value.slice(PNG.length);
 let out='';
 // Padding and an odd trailing character are left as ASCII; packed chars
 // start at U+0100 so decoding is unambiguous.
 for(let i=0;i<data.length;){
  const a=BASE64.indexOf(data[i]), b=BASE64.indexOf(data[i+1]||'=');
  if(a>=0&&b>=0){out+=String.fromCharCode(PACK_OFFSET+(a<<6)+b);i+=2;}
  else{out+=data[i++];}
 }
 return out;
}
function unpackPng(value:string):string{
 if(typeof value!=='string')throw new Error('Invalid packed sprite');
 let out=PNG;
 for(let i=0;i<value.length;i++){
  const code=value.charCodeAt(i)-PACK_OFFSET;
  if(code>=0&&code<4096)out+=BASE64[code>>6]+BASE64[code&63];
  else if(BASE64.includes(value[i])||value[i]==='=')out+=value[i];
  else throw new Error('Invalid packed sprite');
 }
 if(!isPng(out))throw new Error('Invalid packed PNG');
 return out;
}
export function isPackedLocalSave(value:any):boolean{
 return value?.version===PACKED_LOCAL_VERSION&&value?.encoding===ENCODING;
}
export function encodePackedLocalSave(envelope:any):string{
 const sprites:string[]=[];
 const ids=new Map<string,number>();
 const copy=JSON.parse(JSON.stringify(envelope,(key,value)=>{
  if(key!=='customSpriteUrl'||!isPng(value))return value;
  let id=ids.get(value);
  if(id===undefined){id=sprites.length;ids.set(value,id);sprites.push(packPng(value));}
  return {packedPng:id};
 }));
 return JSON.stringify({version:PACKED_LOCAL_VERSION,savedAt:envelope.savedAt,encoding:ENCODING,sprites,payload:copy});
}
export function decodePackedLocalSave(value:any):any{
 if(!isPackedLocalSave(value)||!Array.isArray(value.sprites)||!value.payload||value.payload.version!==3||value.payload.savedAt!==value.savedAt)throw new Error('Invalid packed save');
 const sprites=value.sprites.map(unpackPng);
 return JSON.parse(JSON.stringify(value.payload),(key,entry)=>{
  if(key!=='customSpriteUrl'||!entry||typeof entry!=='object')return entry;
  const id=entry.packedPng;
  if(!Number.isInteger(id)||id<0||id>=sprites.length||Object.keys(entry).length!==1)throw new Error('Invalid packed sprite reference');
  return sprites[id];
 });
}
