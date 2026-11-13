import { openLocalSaveDatabase, LocalSaveConflict, LOCAL_DATABASE_MARKER_VERSION, LOCAL_DATABASE_ENCODING, type LocalSaveDatabase } from './localSaveDatabase';
import { encodeCompressedLocalSave, decodeCompressedLocalSave, isCompressedLocalSave, COMPRESSED_LOCAL_VERSION, COMPRESSED_LOCAL_ENCODING } from './compressedLocalSave';
import { encodePackedLocalSave, decodePackedLocalSave, isPackedLocalSave, PACKED_LOCAL_VERSION } from './packedLocalSave';
import { emptyEconomy, validEconomy, applySale, type Economy } from './economy';
import { validCopyCounts } from './elementCopies';
import type { CollectorVariant } from './collectorData';
import { discoveryIdentity } from './unifiedCollection';
import { isSpriteReference } from './spriteReference';
import { isRarityTier } from './rarity';
import { validKitchenRecipe } from './kitchen/engine';
import { STARTER_ELEMENTS, type InfiniteElement } from './infiniteCraftData';
import { mergeFoundryIntoCraft } from './unifiedCollection';
import { sanitizeTrophyRoom, type TrophyRoom } from './collectorData';
import { loadBoardLayout, parseBoardLayout, saveBoardLayout, type SavedBoardTile } from './boardLayout';
import { ALL_PROCESSES, INITIAL_HABITATS } from './starterData';
import { record, text, strings, finite, color, validMaterial, validOddkin } from './validation';

export const SAVE_KEY = 'coco_kemon_save_v2';
/**
 * Save-version deployment guard.
 *
 * A build must never load, and especially never overwrite, a save written by
 * a newer build: an older build does not know the newer format, so writing
 * over it would silently destroy progress the newer build understands.
 * This guard only covers the version-2 localStorage envelope below. It
 * cannot stop a deployment that changes the format without bumping the
 * version, and it cannot protect cloud backups or saves imported from
 * elsewhere — those paths still validate structure, but version is the
 * only deployment guard. Do not claim a stronger guarantee than that.
 */
export const SAVE_FORMAT_VERSION = 3;
export const NEWER_SAVE_MESSAGE = 'This save was created by a newer version of Boop and cannot be opened by this build. Update the app instead of overwriting it.';
export class NewerSaveError extends Error {
  constructor() { super(NEWER_SAVE_MESSAGE); this.name = 'NewerSaveError'; }
}
export function assertSaveVersion(version: unknown): void {
  if (typeof version === 'number' && version > SAVE_FORMAT_VERSION) throw new NewerSaveError();
}
export const SAVE_IMPORTED_EVENT = 'coco-kemon-save-imported';
export const SAVE_CHANGED_EVENT = 'quarkpop-save-changed';
export const SAVE_STATUS_EVENT = 'coco-kemon-save-status';
/** Largest data-URL a sprite may have inside the save. Shared with Sprite Lab so it can shrink images to fit. */
export const MAX_SPRITE_CHARS = 100000;
const STALE_TAB_MESSAGE = 'Another tab or window updated your save, so this one stopped saving to avoid overwriting it. Export a backup if you made progress here, then reload.';
class StaleSaveError extends Error {}
// savedAt of the envelope this tab last read or wrote; used to detect writes from other tabs.
let lastSeenSavedAt: number | undefined;
function storedSavedAt(): number {
  const match = localStorage.getItem(SAVE_KEY)?.slice(0, 120).match(/"savedAt":(\d+)/);
  return match ? Number(match[1]) : 0;
}
const LEGACY_FOUNDRY = 'oddkin_foundry_save_v1';
const LEGACY_CRAFT = 'neal_infinite_craft_elements_v1';
let craftMemory: InfiniteElement[] | undefined;

// Crafting can update a large save with hundreds of embedded PNG sprites.
// Keep the newest result available synchronously to Foundry/Collection, but
// serialize the entire save only once the browser is idle. Page suspension
// flushes outstanding writes so moving Boop to the background is safe.
type QueuedCraftWrite = {
  elements: InfiniteElement[];
  normalize: (items: InfiniteElement[]) => InfiniteElement[];
};
let queuedCraftWrite: QueuedCraftWrite | null = null;
let craftWriteTimer: ReturnType<typeof setTimeout> | undefined;
let craftIdleHandle: number | undefined;
let craftFlushListenersReady = false;
function cancelCraftWriteTimer() {
  if (craftWriteTimer !== undefined) { clearTimeout(craftWriteTimer); craftWriteTimer = undefined; }
  if (craftIdleHandle !== undefined && typeof window !== 'undefined') {
    (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(craftIdleHandle);
    craftIdleHandle = undefined;
  }
}
export function flushQueuedCraftSave(): void {
  cancelCraftWriteTimer();
  const queued = queuedCraftWrite;
  queuedCraftWrite = null;
  if (queued) saveCraftElements(queued.normalize(queued.elements));
}
export function queueCraftElementsSave(
  elements: InfiniteElement[],
  normalize: (items: InfiniteElement[]) => InfiniteElement[] = items => items,
): void {
  // Reads from another tab view must see the just-crafted discovery before
  // the expensive full JSON write finishes.
  craftMemory = elements;
  queuedCraftWrite = { elements, normalize };
  cancelCraftWriteTimer();
  if (typeof window !== 'undefined' && !craftFlushListenersReady) {
    craftFlushListenersReady = true;
    window.addEventListener('pagehide', flushQueuedCraftSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushQueuedCraftSave();
    });
  }
  craftWriteTimer = setTimeout(() => {
    craftWriteTimer = undefined;
    const idle = typeof window === 'undefined' ? undefined
      : (window as Window & { requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number }).requestIdleCallback;
    if (idle) craftIdleHandle = idle(() => { craftIdleHandle = undefined; flushQueuedCraftSave(); }, { timeout: 1500 });
    else flushQueuedCraftSave();
  }, 180);
}

let saveError: string | null = null;
let recoveryRequired = false;
let envelopeLoaded = false;
let envelopeMemory: any = null;
export const getSaveError = () => saveError;
function status(message: string | null) {
  saveError = message;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SAVE_STATUS_EVENT, { detail: message }));
}
// Drop the cached envelope so the next read re-parses localStorage.
export function invalidateStoredEnvelope() {
  envelopeLoaded = false;
  envelopeMemory = null;
}
const unique = (items: any[], key: string) => new Set(items.map(x => x[key])).size === items.length;
export function validateCraft(v: unknown): v is InfiniteElement[] {
  return Array.isArray(v) && v.every(x => record(x) && (x.kitchenRecipe === undefined || validKitchenRecipe(x.kitchenRecipe)) && text(x.id) && text(x.name) && text(x.emoji) &&
    (['explanation', 'connection', 'variantOf'].every(k => x[k] === undefined || (text(x[k]) && x[k].length <= 280))) &&
    (x.category === undefined || (text(x.category) && x.category.length <= 36)) &&
    (x.customSpriteUrl === undefined || (typeof x.customSpriteUrl === 'string' && x.customSpriteUrl.length <= MAX_SPRITE_CHARS && (/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(x.customSpriteUrl) || isSpriteReference(x.customSpriteUrl)))) &&
    (x.discoveredAt === undefined || finite(x.discoveredAt)) && (x.isNew === undefined || typeof x.isNew === 'boolean') &&
    (x.copyCounts === undefined || validCopyCounts(x.copyCounts)) &&
    (x.isStarter === undefined || typeof x.isStarter === 'boolean') &&
    (x.isShiny === undefined || typeof x.isShiny === 'boolean') &&
    (x.unlockedShiny === undefined || typeof x.unlockedShiny === 'boolean') &&
    (x.unlockedCelestial === undefined || typeof x.unlockedCelestial === 'boolean') &&
    (x.celestialDiscoveredAt === undefined || finite(x.celestialDiscoveredAt)) &&
    (x.rarityTier === undefined || isRarityTier(x.rarityTier)) &&
    (x.rarityDiscoveredAt === undefined || finite(x.rarityDiscoveredAt)) &&
    (x.unlockedHolo === undefined || typeof x.unlockedHolo === 'boolean') &&
    (x.holoDiscoveredAt === undefined || finite(x.holoDiscoveredAt)) &&
    (x.unlockedGlitch === undefined || typeof x.unlockedGlitch === 'boolean') &&
    (x.glitchDiscoveredAt === undefined || finite(x.glitchDiscoveredAt)) &&
    (x.recipe === undefined || (record(x.recipe) && text(x.recipe.first) && text(x.recipe.second)))) && unique(v, 'id');
}
export function validateFoundry(v: unknown): boolean {
  return record(v) && Array.isArray(v.materials) && v.materials.every(validMaterial) && unique(v.materials, 'id') &&
    Array.isArray(v.oddkinCollection) && v.oddkinCollection.every(validOddkin) && unique(v.oddkinCollection, 'speciesId') &&
    Array.isArray(v.processes) && v.processes.every((p: unknown) => record(p) && ['id','name','verb','description','category','symbol'].every(k => text(p[k])) && typeof p.unlocked === 'boolean') &&
    Array.isArray(v.experiments) && v.experiments.every((e: unknown) => record(e) && text(e.id) && finite(e.timestamp) && strings(e.inputNames) && text(e.processName) && typeof e.success === 'boolean' && typeof e.observation === 'string') &&
    Array.isArray(v.habitats) && v.habitats.every((h: unknown) => record(h) && text(h.id) && text(h.name) && text(h.type) && typeof h.description === 'string' && strings(h.residentOddkinIds) && finite(h.lastHarvestTimestamp) && record(h.themePalette) && ['sky','ground','accent','foliage'].every(k => color(h.themePalette[k])));
}
// Browser boot hydrates this synchronous game view before any React state is
// created. Only IndexedDB transactions establish durability after migration.
let localDatabase:LocalSaveDatabase|null=null;
let databaseRevision=0;
let databaseEnvelope:any=null;
let pendingEnvelope:any=null;
let databaseDrain:Promise<void>|null=null;
let databaseFailure:unknown=null;
let databaseConflict=false;
let initialization:Promise<void>|null=null;
function validateLocalEnvelope(v:any):void{
 assertSaveVersion(v?.version);
 if(!record(v)||![2,SAVE_FORMAT_VERSION].includes(v.version)||!validateCraft(v.crafting)||(v.foundry!==null&&!validateFoundry(v.foundry)))throw new Error('Invalid saved data');
 if(v.version===3&&!validEconomy(v.economy))throw new Error('Invalid wallet data');
}
function markDatabaseSave(savedAt:number){
 try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:LOCAL_DATABASE_MARKER_VERSION,savedAt,encoding:LOCAL_DATABASE_ENCODING}));}catch{/* Database is authoritative even if localStorage is blocked. */}
}
export function initializeLocalSave(open:()=>Promise<LocalSaveDatabase>=()=>openLocalSaveDatabase()):Promise<void>{
 if(initialization)return initialization;
 initialization=(async()=>{
  const raw=localStorage.getItem(SAVE_KEY);
  const marker=raw?JSON.parse(raw):null;
  const migrated=marker?.version===LOCAL_DATABASE_MARKER_VERSION&&marker?.encoding===LOCAL_DATABASE_ENCODING;
  let db:LocalSaveDatabase;
  try{db=await open();}catch(error){if(migrated)throw error;return;}// Legacy fallback only before migration.
  let saved=await db.read();
  if(saved){
   validateLocalEnvelope(saved.envelope);
   if(!Number.isSafeInteger(saved.revision)||saved.revision<1)throw new Error('Invalid device save revision.');
   if(!migrated&&marker&&Number(marker.savedAt)>Number(saved.envelope.savedAt))throw new Error('An older app version saved newer progress. Export that save before continuing.');
  }else if(migrated){
   throw new Error('The IndexedDB save is missing. Your legacy marker has been preserved. Restore from a cloud or exported backup instead of starting over.');
  }else{
   // Decode all supported legacy formats through the existing validator.
   const previous=storedEnvelope();
   if(previous){
    validateLocalEnvelope(previous);
    const envelope={...previous,version:3,economy:previous.economy??emptyEconomy()};
    saved=await db.commit(envelope,0,raw??undefined);
    const verified=await db.read();
    if(!verified||verified.revision!==saved.revision||JSON.stringify(verified.envelope)!==JSON.stringify(envelope))throw new Error('Device migration could not be verified.');
    saved=verified;
   }else{
    const craft=readCraftElements();
    const foundryRaw=localStorage.getItem(LEGACY_FOUNDRY);
    const foundry=foundryRaw?JSON.parse(foundryRaw):null;
    if(recoveryRequired)throw new Error('Existing device save needs recovery.');
    const envelope={version:3,savedAt:Date.now(),crafting:mergeFoundryIntoCraft(craft,foundry),foundry,economy:emptyEconomy(),collectorRoom:sanitizeTrophyRoom(null,craft),boardLayout:loadBoardLayout(craft)??[]};
    validateLocalEnvelope(envelope);
    saved=await db.commit(envelope,0,JSON.stringify({craft:localStorage.getItem(LEGACY_CRAFT),foundry:foundryRaw}));
    const verified=await db.read();if(!verified||verified.revision!==saved.revision||JSON.stringify(verified.envelope)!==JSON.stringify(envelope))throw new Error('Device migration could not be verified.');saved=verified;
   }
  }
  localDatabase=db;databaseRevision=saved.revision;databaseEnvelope=saved.envelope;
  envelopeMemory=databaseEnvelope;envelopeLoaded=true;craftMemory=undefined;lastSeenSavedAt=databaseEnvelope.savedAt;
  markDatabaseSave(databaseEnvelope.savedAt);
  try{void navigator.storage?.persist?.().catch(()=>{});}catch{/* Optional eviction protection. */}
 })();
 return initialization;
}
export function getLocalSaveBackend(){return localDatabase?'IndexedDB':'localStorage';}
export function getLocalSavePending(){return !!pendingEnvelope||!!databaseDrain;}
function notifySaveStatus(){if(typeof window!=='undefined')window.dispatchEvent(new Event(SAVE_STATUS_EVENT));}
function drainDatabase(){
 if(!localDatabase||databaseDrain||!pendingEnvelope||databaseConflict)return;
 const db=localDatabase;
 databaseDrain=(async()=>{
  while(pendingEnvelope){
   const candidate=pendingEnvelope;
   try{
    const committed=await db.commit(candidate,databaseRevision);
    databaseRevision=committed.revision;
    if(pendingEnvelope===candidate)pendingEnvelope=null;
    databaseFailure=null;markDatabaseSave(candidate.savedAt);
    status(null);
   }catch(error){
    databaseFailure=error;
    if(error instanceof LocalSaveConflict){databaseConflict=true;status(STALE_TAB_MESSAGE);}
    else status('Progress could not be saved to IndexedDB. Your last saved copy is intact. Export a device backup or retry saving.');
    break;
   }
  }
 })().finally(()=>{databaseDrain=null;notifySaveStatus();});
 notifySaveStatus();
}
export async function waitForLocalSave():Promise<void>{
 if(!localDatabase)return;
 if(pendingEnvelope&&!databaseDrain&&!databaseConflict)drainDatabase();
 while(databaseDrain)await databaseDrain;
 if(pendingEnvelope||databaseFailure)throw databaseFailure||new Error('Device save is not confirmed.');
}
export async function keepLocalRecovery(json:string):Promise<void>{
 if(localDatabase){await localDatabase.recovery(json);return;}
 localStorage.setItem('coco_kemon_before_cloud_load',json);
}
export async function readLocalRecovery():Promise<string|null>{
 if(localDatabase){const value=await localDatabase.recovery();if(value)return value;}
 return localStorage.getItem('coco_kemon_before_cloud_load');
}
function storedEnvelope(): any {
  if(localDatabase)return databaseEnvelope;
  if (envelopeLoaded) return envelopeMemory;
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    envelopeLoaded = true;
    envelopeMemory = null;
    lastSeenSavedAt ??= 0;
    return null;
  }
  const stored = JSON.parse(raw);
  const v = isCompressedLocalSave(stored) ? decodeCompressedLocalSave(stored) : isPackedLocalSave(stored) ? decodePackedLocalSave(stored) : stored;
  assertSaveVersion(v.version);
  if (!record(v) || ![2, SAVE_FORMAT_VERSION].includes(v.version) || !validateCraft(v.crafting) || (v.foundry !== null && !validateFoundry(v.foundry))) throw new Error('Invalid saved data');
  if (v.version === 3 && !validEconomy(v.economy)) throw new Error('Invalid wallet data');
  envelopeLoaded = true;
  envelopeMemory = v;
  lastSeenSavedAt ??= Number.isFinite(v.savedAt) ? v.savedAt : 0;
  return v;
}
export function readFoundrySave(): string | null {
  try {
    const envelope = storedEnvelope();
    const raw = envelope ? (envelope.foundry ? JSON.stringify(envelope.foundry) : null) : localStorage.getItem(LEGACY_FOUNDRY);
    if (raw && !validateFoundry(JSON.parse(raw))) throw new Error('Invalid foundry save');
    return raw;
  }
  catch (error) { recoveryRequired = true; status(error instanceof NewerSaveError ? error.message : 'Saved data could not be loaded. Your stored copy has been preserved. Import a valid backup to recover.'); return null; }
}
export function readCraftElements(): InfiniteElement[] {
  if (craftMemory) return craftMemory;
  try {
    const v = storedEnvelope()?.crafting ?? JSON.parse(localStorage.getItem(LEGACY_CRAFT) || 'null') ?? STARTER_ELEMENTS;
    if (!validateCraft(v)) throw new Error('Invalid crafting collection');
    return craftMemory = mergeFoundryIntoCraft(v, storedEnvelope()?.foundry);
  } catch (error) { recoveryRequired = true; status(error instanceof NewerSaveError ? error.message : 'Crafting save could not be loaded. Import a valid backup to recover.'); return STARTER_ELEMENTS; }
}
function write(foundry: any, crafting: InfiniteElement[], force = false, collectorRoom?: TrophyRoom, boardLayout?: SavedBoardTile[] | null, economy?: Economy) {
  // Deployment guard first: never let an older build overwrite a save written
  // by a newer one, even if the envelope is otherwise unreadable here. This
  // runs before any setItem and before the stale-tab check.
  if (!force && !localDatabase) {
    const rawVersion = Number(localStorage.getItem(SAVE_KEY)?.slice(0, 120).match(/"version":(\d+)/)?.[1]);
    // The tagged packed local format is understood by this build only.
    const supportedPacked = rawVersion === PACKED_LOCAL_VERSION && localStorage.getItem(SAVE_KEY)?.slice(0,120).includes('"encoding":"boop-png-dictionary-v1"');
    const supportedCompressed = rawVersion === COMPRESSED_LOCAL_VERSION && localStorage.getItem(SAVE_KEY)?.slice(0,160).includes('"encoding":"'+COMPRESSED_LOCAL_ENCODING+'"');
    if (Number.isFinite(rawVersion) && rawVersion > SAVE_FORMAT_VERSION && !supportedPacked && !supportedCompressed) {
      status(NEWER_SAVE_MESSAGE);
      throw new NewerSaveError();
    }
  }
  // Refuse to overwrite a save that another tab wrote after this tab last read it.
  if (!localDatabase && !force && lastSeenSavedAt !== undefined && storedSavedAt() > lastSeenSavedAt) {
    status(STALE_TAB_MESSAGE);
    throw new StaleSaveError(STALE_TAB_MESSAGE);
  }
  // One shared discovery inventory. Foundry's full metadata is retained separately.
  const unifiedCrafting = mergeFoundryIntoCraft(crafting, foundry);
  if (!validateCraft(unifiedCrafting) || (foundry !== null && !validateFoundry(foundry))) throw new Error('Invalid merged collection');
  // Do not publish a failed sale or import in memory. Craft callers retain
  // their pending discoveries independently for backup on quota failure.
  const savedAt = Math.max(Date.now(), (lastSeenSavedAt ?? 0) + 1);
  // One setItem commits both collections atomically. Quota failures leave the old save intact.
  const previousRoom = collectorRoom ?? storedEnvelope()?.collectorRoom;
  const envelope = { version: SAVE_FORMAT_VERSION, savedAt, foundry, crafting: unifiedCrafting,
    economy: economy ?? storedEnvelope()?.economy ?? emptyEconomy(),
    collectorRoom: sanitizeTrophyRoom(previousRoom, unifiedCrafting),
    boardLayout: boardLayout ?? loadBoardLayout(crafting) ?? [] };
  if(localDatabase){
    if(databaseConflict)throw new StaleSaveError(STALE_TAB_MESSAGE);
    // Immutable logical snapshot; subsequent React mutations cannot change an
    // in-flight transaction. Coalesce rapid crafting into the newest snapshot.
    const snapshot=structuredClone(envelope);
    databaseEnvelope=snapshot;envelopeMemory=snapshot;envelopeLoaded=true;
    craftMemory=unifiedCrafting;lastSeenSavedAt=savedAt;
    pendingEnvelope=snapshot;drainDatabase();
    if(typeof window!=='undefined')window.dispatchEvent(new Event(SAVE_CHANGED_EVENT));
    return;
  }
  const json=JSON.stringify(envelope);
  try { localStorage.setItem(SAVE_KEY,json); }
  catch(error) {
    if(!quotaExceeded(error))throw error;
    const packed=encodePackedLocalSave(envelope);
    try {
      if(packed.length>=json.length)throw error;
      localStorage.setItem(SAVE_KEY,packed);
    } catch(packedError) {
      if(!quotaExceeded(packedError))throw packedError;
      // Large collections also repeat metadata, recipes and sprite paths.
      // Compress the entire logical envelope, not merely embedded PNGs.
      const compressed=encodeCompressedLocalSave(envelope);
      if(compressed.length>=Math.min(json.length,packed.length))throw packedError;
      localStorage.setItem(SAVE_KEY,compressed);
    }
  }
  craftMemory = unifiedCrafting;
  lastSeenSavedAt = savedAt;
  invalidateStoredEnvelope();
  status(null);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SAVE_CHANGED_EVENT));
}
function quotaExceeded(error:unknown):boolean {
  const e=error as {name?:string;code?:number}|null;
  return e?.name==='QuotaExceededError'||e?.name==='NS_ERROR_DOM_QUOTA_REACHED'||e?.code===22||e?.code===1014||(error instanceof Error&&error.message==='QuotaExceeded');
}
function reportWriteError(error:unknown):void {
  if(error instanceof NewerSaveError){status(error.message);return;}
  if(error instanceof StaleSaveError)return;
  if(quotaExceeded(error)){status('Progress could not be saved: device storage is full. Export a device backup from Save Management before closing Boop.');return;}
  if((error as {name?:string}|null)?.name==='SecurityError'){status('Progress could not be saved: local storage is blocked. Export a device backup from Save Management.');return;}
  if(error instanceof Error&&error.message==='Invalid merged collection'){status('Progress could not be saved: a discovery or Foundry record failed validation. Export a device backup from Save Management.');return;}
  if(recoveryRequired&&saveError){status('Progress could not be saved: the existing save needs recovery. Your stored copy is preserved. Export a backup before importing or restarting.');return;}
  status('Progress could not be saved. Keep this page open and export a backup from Save Management.');
}
export function saveCraftElements(elements: InfiniteElement[]) {
  // An explicit Sprite Lab/Kitchen update must never be overwritten later
  // by an older delayed Craft write.
  if (queuedCraftWrite) { queuedCraftWrite = null; cancelCraftWriteTimer(); }
  // A newer-save refusal must survive: do not let a later generic save error
  // overwrite the message telling the player to update instead of saving.
  if (recoveryRequired && saveError && /newer version/i.test(saveError)) return;
  craftMemory = elements; // Keep export available even when browser storage is full.
  try {
    if (recoveryRequired) throw new Error('Recovery required');
    // Never commit data that the loader would reject on the next launch (that locks the player out).
    const oversizedSprite = elements.some(x => typeof x?.customSpriteUrl === 'string' && x.customSpriteUrl.length > MAX_SPRITE_CHARS);
    if (!validateCraft(elements)) {
      status(oversizedSprite
        ? 'A sprite image is too large to store in your save. Try a smaller image.'
        : 'Some discoveries failed validation, so this change was not saved. Export a backup and reload.');
      return;
    }
    const envelope = storedEnvelope();
    const legacy = envelope ? envelope.foundry : JSON.parse(localStorage.getItem(LEGACY_FOUNDRY) || 'null');
    if (legacy !== null && !validateFoundry(legacy)) throw new Error('Invalid existing save');
    // Keep the complete pending inventory exportable even if both writes fail.
    craftMemory=mergeFoundryIntoCraft(elements,legacy);
    write(legacy, craftMemory);
  } catch (error) { reportWriteError(error); }
}
export function saveFoundry(foundry: any) {
  try {
    if (recoveryRequired) throw new Error('Recovery required');
    storedEnvelope();
    const crafting = readCraftElements();
    if (recoveryRequired) throw new Error('Recovery required');
    if(validateFoundry(foundry))craftMemory=mergeFoundryIntoCraft(crafting,foundry);
    write(foundry, crafting);
  }
  catch (error) { reportWriteError(error); }
}
/** Room layout lives with the existing version-2 game save, not a separate fragile local preference. */
export function readCollectorRoom(): TrophyRoom {
  try { return sanitizeTrophyRoom(storedEnvelope()?.collectorRoom, readCraftElements()); }
  catch { return sanitizeTrophyRoom(null, readCraftElements()); }
}
export function saveCollectorRoom(room: TrophyRoom): void {
  try {
    if (recoveryRequired) throw new Error('Recovery required');
    const envelope = storedEnvelope();
    const foundry = envelope ? envelope.foundry : JSON.parse(localStorage.getItem(LEGACY_FOUNDRY) || 'null');
    const crafting = readCraftElements();
    if (foundry !== null && !validateFoundry(foundry)) throw new Error('Invalid foundry data');
    write(foundry, crafting, false, sanitizeTrophyRoom(room, crafting));
  } catch (error) { status(error instanceof NewerSaveError ? error.message : 'Trophy room could not be saved. Export a backup before changing devices.'); }
}
export function exportCompleteSave(foundry: any): string {
  return JSON.stringify({ version: SAVE_FORMAT_VERSION, economy: readEconomy(), exportedAt: new Date().toISOString(), foundry,
    crafting: readCraftElements(), collectorRoom: readCollectorRoom(),
    boardLayout: loadBoardLayout(readCraftElements()) ?? [] }, null, 2);
}
export function parseSave(json: string) {
  const v = JSON.parse(json);
  assertSaveVersion(v.version);
  if (!record(v) || ![1, 2, 3].includes(v.version)) throw new Error('Unsupported save version');
  const foundry = v.version >= 2 ? v.foundry : { ...v, oddkinCollection: v.oddkinCollection ?? [], processes: v.processes ?? ALL_PROCESSES, experiments: v.experiments ?? [], habitats: v.habitats ?? INITIAL_HABITATS };
  const crafting = v.version >= 2 ? v.crafting : readCraftElements();
  if (!validateFoundry(foundry) || !validateCraft(crafting)) throw new Error('Invalid backup');
  if (v.version === 3 && !validEconomy(v.economy)) throw new Error('Invalid wallet data');
  return { foundry, crafting, economy: v.version === 3 ? v.economy as Economy : v.version === 1 ? readEconomy() : emptyEconomy(),
    collectorRoom: sanitizeTrophyRoom(v.version >= 2 ? v.collectorRoom : null, crafting),
    boardLayout: v.version >= 2 && 'boardLayout' in v
      ? parseBoardLayout(v.boardLayout, crafting) : null };
}
export function importCompleteSave(json: string) {
  const parsed = parseSave(json);
  queuedCraftWrite = null;
  cancelCraftWriteTimer();
  write(parsed.foundry, parsed.crafting, true, parsed.collectorRoom, parsed.boardLayout, parsed.economy);
  if (parsed.boardLayout !== null) saveBoardLayout(parsed.boardLayout);
  recoveryRequired = false;
  craftMemory = mergeFoundryIntoCraft(parsed.crafting, parsed.foundry);
  window.dispatchEvent(new Event(SAVE_IMPORTED_EVENT));
  return parsed.foundry;
}

/** Wallet data shares the same durable commit as sale receipts and both collections. */
export function readEconomy(): Economy {
  try { return structuredClone(storedEnvelope()?.economy ?? emptyEconomy()); }
  catch { return emptyEconomy(); }
}
export function sellElement(name: string, form: CollectorVariant, quantity = 1, expectedPrice?: number) {
  flushQueuedCraftSave();
  if (recoveryRequired || getSaveError() || getLocalSavePending()) throw new Error('Save your progress successfully before selling.');
  const envelope = storedEnvelope();
  const crafting = readCraftElements();
  const element = crafting.find(item => discoveryIdentity(item.name) === discoveryIdentity(name));
  if (!element) throw new Error('This discovery is not in your collection.');
  const result = applySale(element, envelope?.economy ?? emptyEconomy(), form, quantity, crafting);
  if (expectedPrice !== undefined && expectedPrice !== result.price) throw new Error('Value changed. Close and reopen this discovery before selling.');
  const foundry = envelope ? envelope.foundry : JSON.parse(localStorage.getItem(LEGACY_FOUNDRY) || 'null');
  try { write(foundry, crafting, false, undefined, undefined, result.economy); }
  catch (error) {
    if (!(error instanceof StaleSaveError)) status('Sale could not be saved. Your coins and copies have not changed.');
    throw error;
  }
  return result;
}
