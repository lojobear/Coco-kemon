/** Lossless synchronous local-only compression for large collections. The
 * tagged envelope stays atomic in localStorage; cloud/export remain v3 JSON.
 * 12-bit LZW codes use safe non-surrogate code units and explicit resets. */
export const COMPRESSED_LOCAL_VERSION=5;
export const COMPRESSED_LOCAL_ENCODING='boop-lzw-json-v1';
const RESET=256, FIRST=257, LIMIT=4096, OFFSET=0x100, MAX_BYTES=32*1024*1024;
export function isCompressedLocalSave(v:any):boolean{return v?.version===COMPRESSED_LOCAL_VERSION&&v?.encoding===COMPRESSED_LOCAL_ENCODING;}
export function encodeCompressedLocalSave(envelope:any):string{
 const bytes=new TextEncoder().encode(JSON.stringify(envelope));
 if(bytes.length>MAX_BYTES)throw new Error('Save exceeds local compression safety limit.');
 const dict=new Map<number,number>();let next=FIRST,prefix=-1;const chunks:string[]=[];let chunk='';
 const emit=(code:number)=>{chunk+=String.fromCharCode(OFFSET+code);if(chunk.length>=8192){chunks.push(chunk);chunk='';}};
 for(const byte of bytes){
  if(prefix<0){prefix=byte;continue;}
  const key=prefix*256+byte,hit=dict.get(key);
  if(hit!==undefined){prefix=hit;continue;}
  emit(prefix);
  if(next<LIMIT)dict.set(key,next++);
  else{emit(RESET);dict.clear();next=FIRST;}
  prefix=byte;
 }
 if(prefix>=0)emit(prefix);chunks.push(chunk);
 return JSON.stringify({version:COMPRESSED_LOCAL_VERSION,savedAt:envelope.savedAt,encoding:COMPRESSED_LOCAL_ENCODING,bytes:bytes.length,data:chunks.join('')});
}
export function decodeCompressedLocalSave(v:any):any{
 if(!isCompressedLocalSave(v)||typeof v.data!=='string'||!Number.isSafeInteger(v.bytes)||v.bytes<1||v.bytes>MAX_BYTES||v.data.length>MAX_BYTES)throw new Error('Invalid compressed save');
 const output=new Uint8Array(v.bytes),dict:Uint8Array[]=[];let next=FIRST,previous:Uint8Array|undefined,pos=0;
 const append=(a:Uint8Array,b:number)=>{const result=new Uint8Array(a.length+1);result.set(a);result[a.length]=b;return result;};
 for(let i=0;i<v.data.length;i++){
  const code=v.data.charCodeAt(i)-OFFSET;
  if(code===RESET){dict.length=0;next=FIRST;previous=undefined;continue;}
  const entry=code>=0&&code<256?Uint8Array.of(code):code>=FIRST&&code<next?dict[code]:code===next&&previous&&next<LIMIT?append(previous,previous[0]):undefined;
  if(!entry||pos+entry.length>output.length)throw new Error('Invalid compressed save code');
  output.set(entry,pos);pos+=entry.length;
  if(previous&&next<LIMIT)dict[next++]=append(previous,entry[0]);
  previous=entry;
 }
 if(pos!==output.length)throw new Error('Incomplete compressed save');
 const decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(output));
 if(decoded?.version!==3||decoded.savedAt!==v.savedAt)throw new Error('Invalid compressed save envelope');
 return decoded;
}
