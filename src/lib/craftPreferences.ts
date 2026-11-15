import { SPAWN_COUNTS, SPAWN_SOURCES, type SpawnCount, type SpawnSource } from './randomSpawn';
import type { SmartRarity } from './smartRandomizer';

export const CRAFT_PREFERENCES_KEY = 'boop-craft-preferences-v1';
export interface CraftPreferences {
  spawnCount: SpawnCount; spawnSource: SpawnSource; spawnCategory: string; spawnRarity: SmartRarity;
  ingredientFilter: 'all'|'new'|'shiny'; sortMode: 'time'|'alpha'|'discoveries'|'shinies'|'crafted'; procedureId: string;
}
export const DEFAULT_CRAFT_PREFERENCES: CraftPreferences = {
  spawnCount:2, spawnSource:'all', spawnCategory:'all', spawnRarity:'all',
  ingredientFilter:'all', sortMode:'time', procedureId:'MIX',
};
export function parseCraftPreferences(value: unknown): CraftPreferences {
  const v = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  return {
    spawnCount: SPAWN_COUNTS.includes(v.spawnCount as SpawnCount) ? v.spawnCount as SpawnCount : 2,
    spawnSource: SPAWN_SOURCES.includes(v.spawnSource as SpawnSource) ? v.spawnSource as SpawnSource : 'all',
    spawnCategory: typeof v.spawnCategory === 'string' && v.spawnCategory.trim() && v.spawnCategory.length <= 120 ? v.spawnCategory : 'all',
    spawnRarity: ['all','rare','epic','legendary'].includes(v.spawnRarity as string) ? v.spawnRarity as SmartRarity : 'all',
    ingredientFilter: ['all','new','shiny'].includes(v.ingredientFilter as string) ? v.ingredientFilter as CraftPreferences['ingredientFilter'] : 'all',
    sortMode: ['time','alpha','discoveries','shinies','crafted'].includes(v.sortMode as string) ? v.sortMode as CraftPreferences['sortMode'] : 'time',
    procedureId: typeof v.procedureId === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(v.procedureId) ? v.procedureId : 'MIX',
  };
}
export function readCraftPreferences(): CraftPreferences {
  try { return parseCraftPreferences(JSON.parse(localStorage.getItem(CRAFT_PREFERENCES_KEY) || 'null')); }
  catch { return { ...DEFAULT_CRAFT_PREFERENCES }; }
}
export function saveCraftPreferences(preferences: CraftPreferences) {
  try { localStorage.setItem(CRAFT_PREFERENCES_KEY, JSON.stringify(parseCraftPreferences(preferences))); }
  catch { /* Crafting remains available when device storage is blocked. */ }
}
