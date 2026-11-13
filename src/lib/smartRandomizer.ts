/**
 * Filter-only random spawning: never unlocks items or calls AI.
 * Sampling always stays uniform within the chosen, disclosed pool.
 */
import { spawnSourcePool, type SpawnSource } from './randomSpawn';
import { buildCollectionCategoryIndex, indexedCategory, collectionCategoryCounts, type CollectionCategoryIndex } from './collectionCategories';
import { rarityRank, type RarityTier, uniformRandomIndex } from './rarity';
import { makePairKey, type InfiniteElement } from './infiniteCraftData';

export type SmartRarity = 'all'|'rare'|'epic'|'legendary';
export interface SmartSpawnFilters {
  source:SpawnSource;
  category:string;
  rarity:SmartRarity;
}
export function smartSpawnPool(items:readonly InfiniteElement[],filters:SmartSpawnFilters,index:CollectionCategoryIndex=buildCollectionCategoryIndex(items)):InfiniteElement[] {
  return spawnSourcePool(items,filters.source).filter(item=>
    (filters.category==='all'||indexedCategory(item,index)===filters.category) &&
    (filters.rarity==='all'||rarityRank(item.rarityTier as RarityTier)>=rarityRank(filters.rarity)));
}
/** Counts reflect source and rarity, while grouping uses the entire inventory. */
export function smartSpawnCategories(items:readonly InfiniteElement[],filters:Omit<SmartSpawnFilters,'category'>,index:CollectionCategoryIndex=buildCollectionCategoryIndex(items)){
  return collectionCategoryCounts(smartSpawnPool(items,{...filters,category:'all'},index),index);
}

/** Only suggest pairs not present in the player's known local recipe history.
 * Small inventories enumerate all possible pairs uniformly. Large inventories
 * use bounded random sampling to avoid quadratic freezes on mobile. */
export function chooseUntriedPair(
  pool:readonly InfiniteElement[],
  history:readonly InfiniteElement[],
  randomIndex:(n:number)=>number=uniformRandomIndex,
):[InfiniteElement,InfiniteElement]|null {
  if(!pool.length)return null;
  const tried=new Set<string>();
  for(const item of history){
    if(item.recipe?.first&&item.recipe.second)tried.add(makePairKey(item.recipe.first,item.recipe.second));
    for(const r of item.recipeHistory||[])if(r.first&&r.second)tried.add(makePairKey(r.first,r.second));
  }
  const missing=(a:InfiniteElement,b:InfiniteElement)=>!tried.has(makePairKey(a.name,b.name));
  if(pool.length<=48){
    const pairs:Array<[InfiniteElement,InfiniteElement]>=[];
    for(let a=0;a<pool.length;a++)for(let b=a;b<pool.length;b++){
      if(missing(pool[a],pool[b]))pairs.push([pool[a],pool[b]]);
    }
    return pairs.length?pairs[randomIndex(pairs.length)]:null;
  }
  for(let t=0;t<120;t++){
    const a=randomIndex(pool.length),b=randomIndex(pool.length);
    if(missing(pool[a],pool[b]))return [pool[a],pool[b]];
  }
  // If random trials miss a rare remaining pair, check a bounded window.
  for(let a=0;a<Math.min(48,pool.length);a++)for(let b=a;b<Math.min(48,pool.length);b++){
    if(missing(pool[a],pool[b]))return [pool[a],pool[b]];
  }
  return null;
}
