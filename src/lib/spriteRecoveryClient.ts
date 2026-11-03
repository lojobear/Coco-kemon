import { requestJson } from './api';
import { getElementEmoji } from './elementEmoji';
import { spriteInventoryItems } from './missingSpriteInventory';
import { spriteVariantKey } from './spriteVariant';
import { readCraftElements, SAVE_CHANGED_EVENT, SAVE_IMPORTED_EVENT } from './saveData';

type SpriteTask = { name:string; shiny:boolean };
type SyncResult = { ready:string[]; added:number; waiting:number };
export const RECOVERY_PROGRESS_EVENT = 'boop-sprite-recovery-progress';
export type RecoveryProgress = { checked:number; total:number; queued:number; restored:number; active:boolean; error?:string };
let progress:RecoveryProgress = { checked:0,total:0,queued:0,restored:0,active:false };
export function spriteRecoveryProgress() { return { ...progress }; }
function publish(update: Partial<RecoveryProgress>) {
  progress={...progress,...update};
  if(typeof window!=='undefined') window.dispatchEvent(new Event(RECOVERY_PROGRESS_EVENT));
}
export async function syncRecoveryBatch(tasks: SpriteTask[]):Promise<SyncResult> {
  return requestJson<SyncResult>('/api/sprite-recovery/sync', {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({tasks}),
  }, 30000);
}
export async function recoveryBudgetStatus() {
  return requestJson<{ budget:{ used:number;limit:number;remaining:number;resetAt:number };backgroundEnabled:boolean;cadenceMinutes:number }>(
    '/api/sprite-recovery/status',{},12000
  );
}

/**
 * Compare actual artwork (including old IndexedDB and signed-in profile copies)
 * before sending tasks. This avoids billing for already-collected sprites.
 * Submits only public discovery names, never account IDs or save data.
 */
export async function scanAndRecoverSprites(isCancelled:()=>boolean=()=>false) {
  const variants=spriteInventoryItems(readCraftElements())
    .filter(x=>!x.customArt)
    .sort((a,b)=>a.discoveredAt-b.discoveredAt || a.name.localeCompare(b.name));
  let checked=0,queued=0,restored=0;
  publish({checked:0,total:variants.length,queued:0,restored:0,active:true,error:undefined});
  try {
    for(let offset=0;offset<variants.length && !isCancelled();offset+=24) {
      const chunk=variants.slice(offset,offset+24);
      const cacheResults=await Promise.all(chunk.map(async item=>{
        try { return Boolean(await getElementEmoji(item.name,false,'',false,item.shiny)); }
        catch { return null; }
      }));
      if(isCancelled())break;
      // Unknown local storage errors are not evidence of missing artwork.
      const missing=chunk.filter((item,i)=>cacheResults[i]===false);
      checked+=chunk.length;
      if(missing.length) {
        const result=await syncRecoveryBatch(missing.map(({name,shiny})=>({name,shiny})));
        queued+=result.added+result.waiting;
        const ready=new Set(result.ready);
        // These are confirmed server-cached. Loading them through the usual API
        // uses cachedWork and the established image cleanup, not paid generation.
        for(const item of missing) {
          if(isCancelled())break;
          if(!ready.has(spriteVariantKey(item.name,item.shiny)))continue;
          try {
            const art=await getElementEmoji(item.name,false,'',true,item.shiny);
            if(art) restored++;
          } catch { /* Will retry on focus or next launch. */ }
        }
      }
      publish({checked,total:variants.length,queued,restored,active:true});
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  } catch(error) {
    publish({error:error instanceof Error?error.message:'Recovery service unavailable'});
  } finally {
    publish({checked,queued,restored,active:false});
  }
}
/** Startup, focus and changed-save recovery are debounced; no background browser thread. */
export function startSpriteRecovery() {
  let stopped=false,active=false,dirty=false,lastScanAt=0;
  let timer: ReturnType<typeof setTimeout>|undefined;
  const launch=async()=>{
    if(stopped)return;
    if(active){dirty=true;return;}
    active=true;lastScanAt=Date.now();
    try{await scanAndRecoverSprites(()=>stopped);}finally{
      active=false;
      if(dirty&&!stopped){dirty=false;schedule(10000);}
    }
  };
  const schedule=(ms=1500)=>{
    if(stopped)return;
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>void launch(),ms);
  };
  const onSave=()=>schedule(5000);
  const onFocus=()=>{
    if(document.visibilityState==='visible'&&Date.now()-lastScanAt>5*60000)schedule(1000);
  };
  window.addEventListener(SAVE_CHANGED_EVENT,onSave);
  window.addEventListener(SAVE_IMPORTED_EVENT,onSave);
  window.addEventListener('online',onSave);
  document.addEventListener('visibilitychange',onFocus);
  schedule(1000);
  return ()=>{
    stopped=true;if(timer)clearTimeout(timer);
    window.removeEventListener(SAVE_CHANGED_EVENT,onSave);
    window.removeEventListener(SAVE_IMPORTED_EVENT,onSave);
    window.removeEventListener('online',onSave);
    document.removeEventListener('visibilitychange',onFocus);
  };
}
