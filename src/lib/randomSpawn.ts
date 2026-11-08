import type { InfiniteElement } from './infiniteCraftData';
import { STARTER_ELEMENTS } from './infiniteCraftData';
import { BOARD_WIDTH, BOARD_HEIGHT, clampBoardTile } from './boardGeometry';
import { uniformRandomIndex } from './rarity';

export type SpawnSource = 'all' | 'recent' | 'shiny' | 'starters';
export type SpawnCount = 1 | 2 | 5 | 10;
export const SPAWN_COUNTS: readonly SpawnCount[] = [1, 2, 5, 10];
export const SPAWN_SOURCES: readonly SpawnSource[] = ['all', 'recent', 'shiny', 'starters'];
const STARTER_NAMES = new Set(STARTER_ELEMENTS.map(item => item.name.toLowerCase()));
const identity = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
function distinctDiscoveries(elements: readonly InfiniteElement[]): InfiniteElement[] {
  const seen = new Set<string>();
  return elements.filter(item => {
    const key = identity(item.name || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Available inventory only: random spawning never invents or unlocks items. */
export function spawnSourcePool(elements: readonly InfiniteElement[], source: SpawnSource): InfiniteElement[] {
  const owned = distinctDiscoveries(elements);
  switch (source) {
    case 'starters': return owned.filter(item => STARTER_NAMES.has(item.name.toLowerCase()));
    case 'shiny': return owned.filter(item => item.isShiny || item.unlockedShiny);
    case 'recent': return owned.filter(item => (item.discoveredAt || 0) > 0)
      .sort((a, b) => (b.discoveredAt || 0) - (a.discoveredAt || 0)).slice(0, 40);
    default: return owned;
  }
}

/** Uniform partial Fisher–Yates: every unique discovery has the same chance
 * to be picked; a batch never repeats until the complete pool is exhausted.
 * Injected random() is only used for deterministic tests. Production uses
 * unbiased Web Crypto sampling when available. */
export function chooseSpawnElements<T>(pool: readonly T[], count: SpawnCount, random?: () => number): T[] {
  if (!pool.length) return [];
  const index = (n:number) => random
    ? Math.min(n-1,Math.max(0,Math.floor(random()*n)))
    : uniformRandomIndex(n);
  const deck = [...pool];
  const picked: T[] = [];
  const uniqueCount = Math.min(count, deck.length);
  for (let i=0;i<uniqueCount;i++) {
    const j=i+index(deck.length-i);
    [deck[i], deck[j]]=[deck[j], deck[i]];
    picked.push(deck[i]);
  }
  // Only a pool smaller than the requested batch permits repeat picks.
  for (let i=uniqueCount;i<count;i++) picked.push(pool[index(pool.length)]);
  return picked;
}

/** Viewport coordinates are always unscaled world units (divide DOM scroll
 * and dimensions by the current CSS zoom before calling these helpers). */
export interface SpawnViewport {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
}

const SPAWN_MARGIN = 12;
const SPAWN_TILE_HEIGHT = 54;
const MAX_SPAWN_TILE_WIDTH = 260;

/** Leave enough room for the whole pill, its buttons and the mobile library
 * control. Bounds are computed fresh after every zoom, pan or resize. */
export function visibleSpawnBounds(viewport: SpawnViewport) {
  const tileWidth = Math.min(MAX_SPAWN_TILE_WIDTH, Math.max(74, viewport.clientWidth - 2 * SPAWN_MARGIN));
  const bottomInset = viewport.clientWidth < 700 ? Math.min(72, viewport.clientHeight * 0.15) : 0;
  const maxWorldX = Math.min(
    BOARD_WIDTH - tileWidth - 8,
    viewport.scrollLeft + viewport.clientWidth - tileWidth - SPAWN_MARGIN,
  );
  const maxWorldY = Math.min(
    BOARD_HEIGHT - SPAWN_TILE_HEIGHT - 8,
    viewport.scrollTop + viewport.clientHeight - SPAWN_TILE_HEIGHT - SPAWN_MARGIN - bottomInset,
  );
  const minX = Math.max(8, Math.min(maxWorldX, viewport.scrollLeft + SPAWN_MARGIN));
  const minY = Math.max(8, Math.min(maxWorldY, viewport.scrollTop + SPAWN_MARGIN));
  return { minX, maxX: Math.max(minX, maxWorldX), minY, maxY: Math.max(minY, maxWorldY),
    tileWidth, tileHeight: SPAWN_TILE_HEIGHT };
}

function withinVisibleSpawn(x: number, y: number, bounds: ReturnType<typeof visibleSpawnBounds>) {
  return {
    x: Math.round(Math.max(bounds.minX, Math.min(bounds.maxX, x))),
    y: Math.round(Math.max(bounds.minY, Math.min(bounds.maxY, y))),
  };
}

/** Center a batch entirely within the current visible workspace. Large batches
 * compress their spacing on short/zoomed-in phone screens instead of spawning
 * outside the user's viewport. */
export function spawnPositions(
  count: number,
  viewport: SpawnViewport | null,
) {
  const visible = viewport ?? {
    scrollLeft: 900, scrollTop: 560, clientWidth: 380, clientHeight: 540,
  };
  const bounds = visibleSpawnBounds(visible);
  const columns = Math.max(1, Math.min(count, 4,
    Math.floor((visible.clientWidth - 2 * SPAWN_MARGIN + 14) / (bounds.tileWidth + 14))));
  const rows = Math.ceil(count / columns);
  const dx = columns > 1 ? Math.min(bounds.tileWidth + 14, (bounds.maxX - bounds.minX) / (columns - 1)) : 0;
  const dy = rows > 1 ? Math.min(64, (bounds.maxY - bounds.minY) / (rows - 1)) : 0;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return withinVisibleSpawn(
      centerX + (column - (columns - 1) / 2) * dx,
      centerY + (row - (rows - 1) / 2) * dy,
      bounds,
    );
  });
}

/** Place repeated batches near their original positions, choosing an empty
 * slot in the *visible* viewport when possible. If the screen is crowded,
 * prefer a visible overlap instead of silently throwing an element off-screen.
 * Never move old tiles, pan the board or make an AI call. */
export function spreadSpawnPositions(
  spots: readonly {x:number;y:number}[],
  occupied: readonly {x:number;y:number}[],
  sequence = 0,
  viewport?: SpawnViewport | null,
): Array<{x:number;y:number}> {
  // Legacy callers without a measured viewport still get bounded placement
  // around the original spots; the Craft board always supplies its viewport.
  const visible = viewport ?? {
    scrollLeft: Math.max(0, Math.min(...spots.map(p => p.x), 900) - 160),
    scrollTop: Math.max(0, Math.min(...spots.map(p => p.y), 560) - 160),
    clientWidth: 380,
    clientHeight: 650,
  };
  const bounds = visibleSpawnBounds(visible);
  const taken = occupied.filter(p =>
    p.x >= bounds.minX - bounds.tileWidth && p.x <= bounds.maxX + bounds.tileWidth &&
    p.y >= bounds.minY - bounds.tileHeight && p.y <= bounds.maxY + bounds.tileHeight,
  ).map(p=>({x:p.x,y:p.y}));
  const candidates: Array<{x:number;y:number}> = [];
  // Include a dense, bounded sampling grid. Unique cells are preferred when
  // space allows; with a full board the smallest-overlap cell still stays in view.
  for (let row = 0; row <= 10; row++) for (let col = 0; col <= 6; col++) {
    candidates.push(withinVisibleSpawn(
      bounds.minX + (bounds.maxX - bounds.minX) * col / 6,
      bounds.minY + (bounds.maxY - bounds.minY) * row / 10,
      bounds,
    ));
  }
  return spots.map((spot,index) => {
    const preferred = withinVisibleSpawn(spot.x, spot.y, bounds);
    const choices = [preferred, ...candidates];
    let best = preferred, bestScore = Infinity;
    for (const candidate of choices) {
      const collisions = taken.reduce((n,p) =>
        n + (Math.abs(p.x - candidate.x) < bounds.tileWidth + 8 &&
             Math.abs(p.y - candidate.y) < bounds.tileHeight + 5 ? 1 : 0), 0);
      const distance = Math.abs(candidate.x - preferred.x) + Math.abs(candidate.y - preferred.y);
      // Existing pills have higher priority than staying exactly centered.
      // Tiny rotating tie-breaker spreads equally good repeated batches.
      const score = collisions * 1_000_000 + distance +
        ((sequence + index) * 7 + Math.round(candidate.x) + Math.round(candidate.y)) % 5;
      if (score < bestScore) { best = candidate; bestScore = score; }
      if (score === 0) break;
    }
    taken.push(best);
    return best;
  });
}

/** Suggest an owned built-in recipe whose result is not yet in the collection.
 * This is a local hint only; it does not combine items or spend AI quota. */
export function chooseUndiscoveredPair(
  elements: readonly InfiniteElement[],
  recipes: Readonly<Record<string, {result:string}>>,
  random: () => number = Math.random,
): [InfiniteElement, InfiniteElement] | null {
  const key = (name:string) => name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
  const owned = new Map(elements.map(item => [key(item.name), item]));
  const options: Array<[InfiniteElement, InfiniteElement]> = [];
  for (const [recipe, value] of Object.entries(recipes)) {
    const names = recipe.split(':::');
    if (names.length !== 2 || owned.has(key(value.result))) continue;
    const first = owned.get(key(names[0])), second = owned.get(key(names[1]));
    if (first && second) options.push([first, second]);
  }
  if (!options.length) return null;
  return options[Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)))];
}
