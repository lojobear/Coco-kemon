import type { InfiniteElement } from './infiniteCraftData';
import { STARTER_ELEMENTS } from './infiniteCraftData';
import { boardCenter, clampBoardTile } from './boardGeometry';
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
