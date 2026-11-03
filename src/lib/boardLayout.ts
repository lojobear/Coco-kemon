import { clampBoardTile } from './boardGeometry';
import type { InfiniteElement } from './infiniteCraftData';

export interface SavedBoardTile {
  instanceId: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  isShiny?: boolean;
}
export const BOARD_LAYOUT_KEY = 'boop-craft-board-v1';
const MAX_BOARD_TILES = 300;

/** Board placement stays local; account discoveries remain in the existing cloud save. */
export function parseBoardLayout(value: unknown, collection: readonly InfiniteElement[]): SavedBoardTile[] | null {
  if (!Array.isArray(value)) return null;
  const names = new Map(collection.map(el=>[el.name.trim().toLowerCase(),el]));
  const ids=new Set<string>();
  const result:SavedBoardTile[]=[];
  for (const item of value.slice(0,MAX_BOARD_TILES)) {
    if (!item || typeof item !== 'object') continue;
    const v=item as Partial<SavedBoardTile>;
    if (typeof v.instanceId!=='string' || v.instanceId.length>96 || !v.instanceId || ids.has(v.instanceId)
      || typeof v.name!=='string' || !Number.isFinite(v.x)||!Number.isFinite(v.y)) continue;
    const found=names.get(v.name.trim().toLowerCase());
    if (!found) continue; // Never reintroduce items cleared by a cloud save import.
    ids.add(v.instanceId);
    result.push({instanceId:v.instanceId,name:found.name,emoji:found.emoji,
      ...clampBoardTile(v.x!,v.y!),isShiny:Boolean(v.isShiny && (found.unlockedShiny || found.isShiny))});
  }
  return result;
}

export function loadBoardLayout(collection:readonly InfiniteElement[]):SavedBoardTile[]|null {
  try {
    const raw=localStorage.getItem(BOARD_LAYOUT_KEY);
    return raw===null?null:parseBoardLayout(JSON.parse(raw),collection);
  }catch{return null;}
}
export function saveBoardLayout(items:readonly SavedBoardTile[]) {
  try { localStorage.setItem(BOARD_LAYOUT_KEY,JSON.stringify(items.slice(-MAX_BOARD_TILES))); }
  catch { /* Core discovery save is more important than optional board positions. */ }
}
