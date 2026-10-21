import type { InfiniteElement } from './infiniteCraftData';
import { STARTER_ELEMENTS } from './infiniteCraftData';
import { boardCenter, clampBoardTile } from './boardGeometry';

export type SpawnSource = 'all' | 'recent' | 'shiny' | 'starters';
export type SpawnCount = 1 | 2 | 5 | 10;
export const SPAWN_COUNTS: readonly SpawnCount[] = [1, 2, 5, 10];
export const SPAWN_SOURCES: readonly SpawnSource[] = ['all', 'recent', 'shiny', 'starters'];
const STARTER_NAMES = new Set(STARTER_ELEMENTS.map(item => item.name.toLowerCase()));

/** Available inventory only: random spawning never invents or unlocks items. */
export function spawnSourcePool(elements: readonly InfiniteElement[], source: SpawnSource): InfiniteElement[] {
  switch (source) {
    case 'starters': return elements.filter(item => STARTER_NAMES.has(item.name.toLowerCase()));
    case 'shiny': return elements.filter(item => item.isShiny || item.unlockedShiny);
    case 'recent': return elements.filter(item => (item.discoveredAt || 0) > 0)
      .sort((a, b) => (b.discoveredAt || 0) - (a.discoveredAt || 0)).slice(0, 40);
    default: return [...elements];
  }
}

/** Draw without duplicates when possible; repeat only if a source has fewer items than requested. */
export function chooseSpawnElements<T>(pool: readonly T[], count: SpawnCount, random: () => number = Math.random): T[] {
  if (!pool.length) return [];
  const unique: T[] = [];
  const used = new Set<number>();
  const total = Math.min(pool.length, count);
  while (unique.length < total) {
    const start = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
    let index = start;
    while (used.has(index)) index = (index + 1) % pool.length;
    used.add(index);
    unique.push(pool[index]);
  }
  for (let i = unique.length; i < count; i++) {
    unique.push(pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))]);
  }
  return unique;
}

/** Compact responsive rows, in world coordinates centered on the visible game area. */
export function spawnPositions(
  count: number,
  viewport: { scrollLeft: number; scrollTop: number; clientWidth: number; clientHeight: number } | null,
) {
  const center = viewport
    ? boardCenter(viewport.scrollLeft, viewport.scrollTop, viewport.clientWidth, viewport.clientHeight)
    : { x: 1050, y: 780 };
  const width = viewport?.clientWidth || 380;
  const columns = Math.max(1, Math.min(4, Math.floor((width - 24) / 160), count));
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return clampBoardTile(
      center.x - 65 - ((columns - 1) * 157) / 2 + column * 157,
      center.y - 25 - ((rows - 1) * 66) / 2 + row * 66,
    );
  });
}
