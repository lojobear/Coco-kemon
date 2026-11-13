/** Local game save database. A single transaction protects the complete
 * collection, wallet, and recovery snapshot from partial writes or stale tabs. */
export const LOCAL_DATABASE_NAME='boop-game-progress';
export const LOCAL_DATABASE_VERSION=1;
export const LOCAL_DATABASE_MARKER_VERSION=6;
export const LOCAL_DATABASE_ENCODING='boop-indexeddb-v1';
const STORE='saves';
export class LocalSaveConflict extends Error {constructor(){super('Another tab updated your device save. Export your progress before reloading.');this.name='LocalSaveConflict';}}
export type LocalSaveRecord={revision:number;envelope:any};
export interface LocalSaveDatabase {
 read():Promise<LocalSaveRecord|null>;
 commit(envelope:any,expectedRevision:number,legacyBackup?:string):Promise<LocalSaveRecord>;
 recovery(value?:string):Promise<string|null>;
}
export function openLocalSaveDatabase(factory:IDBFactory=indexedDB):Promise<LocalSaveDatabase>{
 return new Promise((resolve,reject)=>{
  const opening=factory.open(LOCAL_DATABASE_NAME,LOCAL_DATABASE_VERSION);
  let settled=false;
  const fail=(error:unknown)=>{if(!settled){settled=true;reject(error);}};
  opening.onupgradeneeded=()=>{if(!opening.result.objectStoreNames.contains(STORE))opening.result.createObjectStore(STORE);};
  opening.onerror=()=>fail(opening.error||new Error('Could not open game database.'));
  opening.onblocked=()=>fail(new Error('Game database is blocked by another app window.'));
  opening.onsuccess=()=>{
   const db=opening.result;if(settled){db.close();return;}settled=true;
   db.onversionchange=()=>db.close();
   function readKey<T>(key:string):Promise<T|null>{
    return new Promise((ok,bad)=>{const tx=db.transaction(STORE,'readonly');const request=tx.objectStore(STORE).get(key);
     tx.oncomplete=()=>ok(request.result??null);tx.onabort=tx.onerror=()=>bad(tx.error||new Error('Could not read game database.'));});
   }
   resolve({
    read:()=>readKey<LocalSaveRecord>('current'),
    commit(envelope,expectedRevision,legacyBackup){
     return new Promise((ok,bad)=>{
      const tx=db.transaction(STORE,'readwrite');const store=tx.objectStore(STORE);const req=store.get('current');let result:LocalSaveRecord;let conflict=false;
      req.onsuccess=()=>{
       const current=req.result as LocalSaveRecord|undefined;
       if((current?.revision??0)!==expectedRevision){conflict=true;tx.abort();return;}
       result={revision:expectedRevision+1,envelope};
       // Preserve the exact pre-migration bytes and previous committed snapshot.
       if(legacyBackup!==undefined)store.put(legacyBackup,'legacy-backup');
       if(current)store.put(current,'previous');
       store.put(result,'current');
      };
      tx.oncomplete=()=>ok(result);
      tx.onabort=tx.onerror=()=>bad(conflict?new LocalSaveConflict():tx.error||new Error('Device save transaction failed.'));
     });
    },
    recovery(value){
     if(value===undefined)return readKey<string>('recovery');
     return new Promise((ok,bad)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,'recovery');tx.oncomplete=()=>ok(value);tx.onabort=tx.onerror=()=>bad(tx.error||new Error('Could not keep recovery backup.'));});
    }
   });
  };
 });
}
