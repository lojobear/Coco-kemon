import type { InfiniteElement } from './infiniteCraftData';
import { isSuppliedStarter } from './starterIdentity';
import { discoveryIdentity } from './unifiedCollection';
import { uniformRandomIndex } from './rarity';
export const LIVE_LOGO_INTERVAL_MS = 30_000;
export function logoDiscoveries(items: readonly InfiniteElement[]): InfiniteElement[] {
  const seen=new Set<string>();
  return items.filter(item=>{
    const key=discoveryIdentity(item.name||'');
    if(!key||seen.has(key)||isSuppliedStarter(item))return false;
    seen.add(key);return true;
  });
}
export function nextLogoName(items: readonly InfiniteElement[], current: string|null, randomIndex=uniformRandomIndex): string|null {
  const alternatives=items.filter(item=>discoveryIdentity(item.name)!==current);
  const pool=alternatives.length?alternatives:items;
  return pool.length?discoveryIdentity(pool[randomIndex(pool.length)].name):null;
}
