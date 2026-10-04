import { validKitchenRecipe } from './kitchen/engine';
import { STARTER_ELEMENTS, type InfiniteElement } from './infiniteCraftData';
import { ALL_PROCESSES, INITIAL_HABITATS } from './starterData';
import { record, text, strings, finite, color, validMaterial, validOddkin } from './validation';

export const SAVE_KEY = 'coco_kemon_save_v2';
export const SAVE_IMPORTED_EVENT = 'coco-kemon-save-imported';
export const SAVE_STATUS_EVENT = 'coco-kemon-save-status';
const LEGACY_FOUNDRY = 'oddkin_foundry_save_v1';
const LEGACY_CRAFT = 'neal_infinite_craft_elements_v1';
let craftMemory: InfiniteElement[] | undefined;
let saveError: string | null = null;
let recoveryRequired = false;
export const getSaveError = () => saveError;
function status(message: string | null) {
  saveError = message;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SAVE_STATUS_EVENT, { detail: message }));
}
const unique = (items: any[], key: string) => new Set(items.map(x => x[key])).size === items.length;
export function validateCraft(v: unknown): v is InfiniteElement[] {
  return Array.isArray(v) && v.every(x => record(x) && (x.kitchenRecipe === undefined || validKitchenRecipe(x.kitchenRecipe)) && text(x.id) && text(x.name) && text(x.emoji) &&
    (['explanation', 'connection', 'variantOf'].every(k => x[k] === undefined || (text(x[k]) && x[k].length <= 280))) &&
    (x.customSpriteUrl === undefined || (typeof x.customSpriteUrl === 'string' && x.customSpriteUrl.length <= 100000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(x.customSpriteUrl))) &&
    (x.discoveredAt === undefined || finite(x.discoveredAt)) && (x.isNew === undefined || typeof x.isNew === 'boolean') &&
    (x.isShiny === undefined || typeof x.isShiny === 'boolean') &&
    (x.unlockedShiny === undefined || typeof x.unlockedShiny === 'boolean') &&
    (x.recipe === undefined || (record(x.recipe) && text(x.recipe.first) && text(x.recipe.second)))) && unique(v, 'id');
}
export function validateFoundry(v: unknown): boolean {
  return record(v) && Array.isArray(v.materials) && v.materials.every(validMaterial) && unique(v.materials, 'id') &&
    Array.isArray(v.oddkinCollection) && v.oddkinCollection.every(validOddkin) && unique(v.oddkinCollection, 'speciesId') &&
    Array.isArray(v.processes) && v.processes.every((p: unknown) => record(p) && ['id','name','verb','description','category','symbol'].every(k => text(p[k])) && typeof p.unlocked === 'boolean') &&
    Array.isArray(v.experiments) && v.experiments.every((e: unknown) => record(e) && text(e.id) && finite(e.timestamp) && strings(e.inputNames) && text(e.processName) && typeof e.success === 'boolean' && typeof e.observation === 'string') &&
    Array.isArray(v.habitats) && v.habitats.every((h: unknown) => record(h) && text(h.id) && text(h.name) && text(h.type) && typeof h.description === 'string' && strings(h.residentOddkinIds) && finite(h.lastHarvestTimestamp) && record(h.themePalette) && ['sky','ground','accent','foliage'].every(k => color(h.themePalette[k])));
}
function storedEnvelope(): any {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  const v = JSON.parse(raw);
  if (!record(v) || v.version !== 2 || !validateCraft(v.crafting) || (v.foundry !== null && !validateFoundry(v.foundry))) throw new Error('Invalid saved data');
  return v;
}
export function readFoundrySave(): string | null {
  try {
    const envelope = storedEnvelope();
    const raw = envelope ? (envelope.foundry ? JSON.stringify(envelope.foundry) : null) : localStorage.getItem(LEGACY_FOUNDRY);
    if (raw && !validateFoundry(JSON.parse(raw))) throw new Error('Invalid foundry save');
    return raw;
  }
  catch { recoveryRequired = true; status('Saved data could not be loaded. Your stored copy has been preserved. Import a valid backup to recover.'); return null; }
}
export function readCraftElements(): InfiniteElement[] {
  if (craftMemory) return craftMemory;
  try {
    const v = storedEnvelope()?.crafting ?? JSON.parse(localStorage.getItem(LEGACY_CRAFT) || 'null') ?? STARTER_ELEMENTS;
    if (!validateCraft(v)) throw new Error('Invalid crafting collection');
    return craftMemory = v;
  } catch { recoveryRequired = true; status('Crafting save could not be loaded. Import a valid backup to recover.'); return STARTER_ELEMENTS; }
}
function write(foundry: any, crafting: InfiniteElement[]) {
  // One setItem commits both collections atomically. Quota failures leave the old save intact.
  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, savedAt: Date.now(), foundry, crafting }));
  status(null);
}
export function saveCraftElements(elements: InfiniteElement[]) {
  craftMemory = elements; // Keep export available even when browser storage is full.
  try {
    if (recoveryRequired) throw new Error('Recovery required');
    const envelope = storedEnvelope();
    const legacy = envelope ? envelope.foundry : JSON.parse(localStorage.getItem(LEGACY_FOUNDRY) || 'null');
    if (legacy !== null && !validateFoundry(legacy)) throw new Error('Invalid existing save');
    write(legacy, elements);
  } catch { status('Progress could not be saved. Keep this page open and export a backup from Save Management.'); }
}
export function saveFoundry(foundry: any) {
  try {
    if (recoveryRequired) throw new Error('Recovery required');
    storedEnvelope();
    const crafting = readCraftElements();
    if (recoveryRequired) throw new Error('Recovery required');
    write(foundry, crafting);
  }
  catch { status('Progress could not be saved. Keep this page open and export a backup from Save Management.'); }
}
export function exportCompleteSave(foundry: any): string {
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), foundry, crafting: readCraftElements() }, null, 2);
}
export function parseSave(json: string) {
  const v = JSON.parse(json);
  if (!record(v) || ![1, 2].includes(v.version)) throw new Error('Unsupported save version');
  const foundry = v.version === 2 ? v.foundry : { ...v, oddkinCollection: v.oddkinCollection ?? [], processes: v.processes ?? ALL_PROCESSES, experiments: v.experiments ?? [], habitats: v.habitats ?? INITIAL_HABITATS };
  const crafting = v.version === 2 ? v.crafting : readCraftElements();
  if (!validateFoundry(foundry) || !validateCraft(crafting)) throw new Error('Invalid backup');
  return { foundry, crafting };
}
export function importCompleteSave(json: string) {
  const parsed = parseSave(json);
  write(parsed.foundry, parsed.crafting);
  recoveryRequired = false;
  craftMemory = parsed.crafting;
  window.dispatchEvent(new Event(SAVE_IMPORTED_EVENT));
  return parsed.foundry;
}

