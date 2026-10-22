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

/**
 * Place successive instant-spawn batches without covering existing tiles.
 * Searches a small deterministic neighborhood; no DOM reads or AI calls.
 */
export function spreadSpawnPositions(
  spots: readonly {x:number;y:number}[],
  occupied: readonly {x:number;y:number}[],
  sequence = 0,
): Array<{x:number;y:number}> {
  const taken = occupied.map(p=>({x:p.x,y:p.y}));
  const shifts:Array<[number,number]> = [[0,0]];
  for (let ring=1;ring<=4;ring++) {
    for (let y=-ring;y<=ring;y++) for(let x=-ring;x<=ring;x++) {
      if(Math.max(Math.abs(x),Math.abs(y))===ring)shifts.push([x*154,y*69]);
    }
  }
  return spots.map((spot,index)=>{
    // Prefer the exact visible centered grid on the first spawn. Explore
    // nearby offsets only when that location would overlap an existing tile.
    let selected=clampBoardTile(spot.x,spot.y);
    const overlaps=(candidate:typeof selected)=>taken.reduce((n,p)=>
      n+(Math.abs(p.x-candidate.x)<145 && Math.abs(p.y-candidate.y)<59?1:0),0);
    let bestOverlap=overlaps(selected);
    if(bestOverlap>0) for (let i=1;i<shifts.length;i++) {
      const [dx,dy] = shifts[1+((i-1+(sequence+index)*7)%(shifts.length-1))];
      const candidate=clampBoardTile(spot.x+dx,spot.y+dy);
      const overlap=overlaps(candidate);
      if(overlap<bestOverlap){selected=candidate;bestOverlap=overlap;}
      if(!overlap)break;
    }
    taken.push(selected);
    return selected;
  });
}
