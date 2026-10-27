import type { InfiniteElement } from './infiniteCraftData';
import { spriteVariantKey } from './spriteVariant';
import type { ArtworkTask } from './artworkQueue';

/** Inventory identities are stable across the craft board, queue and saved art. */
export interface SpriteInventoryItem {
  id: string;
  name: string;
  shiny: boolean;
  key: string;
  discoveredAt: number;
  customArt: boolean;
}

export type SpriteInventoryState = 'ready' | 'queued' | 'retry' | 'missing' | 'checking';
export interface SpriteInventoryStatus {
  state: SpriteInventoryState;
  label: string;
  nextAttemptAt?: number;
}

export function spriteInventoryItems(elements: readonly InfiniteElement[]): SpriteInventoryItem[] {
  const seen = new Set<string>();
  const list: SpriteInventoryItem[] = [];
  for (const element of elements) {
    if (!element?.name?.trim()) continue;
    const name = element.name.trim();
    for (const shiny of [false, ...(element.unlockedShiny || element.isShiny ? [true] : [])]) {
      const key = spriteVariantKey(name, shiny);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: element.id,
        name,
        shiny,
        key,
        discoveredAt: Number(element.discoveredAt || element.lastCraftedAt || 0),
        customArt: !shiny && Boolean(element.customSpriteUrl),
      });
    }
  }
  return list.sort((a, b) => b.discoveredAt - a.discoveredAt || a.name.localeCompare(b.name));
}

/** Distinguishes actual saved art from the temporary procedural placeholder. */
export function spriteInventoryState(
  entry: SpriteInventoryItem,
  scanned: boolean | undefined,
  pending: readonly ArtworkTask[],
): SpriteInventoryStatus {
  if (entry.customArt) return { state: 'ready', label: 'Custom art saved' };
  if (scanned === true) return { state: 'ready', label: 'Sprite saved' };
  const task = pending.find(item => spriteVariantKey(item.name, item.shiny) === entry.key);
  if (task) {
    if (task.lastError || task.nextAttemptAt > Date.now()) {
      return { state: 'retry', label: 'Retry scheduled', nextAttemptAt: task.nextAttemptAt };
    }
    return { state: 'queued', label: 'Queued for generation' };
  }
  return scanned === false
    ? { state: 'missing', label: 'Needs generating' }
    : { state: 'checking', label: 'Checking saved art' };
}
