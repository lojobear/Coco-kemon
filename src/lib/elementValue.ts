import type { InfiniteElement } from './infiniteCraftData';
import { CANONICAL_INFINITE_CRAFT_RECIPES, STARTER_ELEMENTS } from './infiniteCraftData';
import { categoryForDiscovery, COLLECTION_CATEGORY_ORDER } from './collectionCategories';
import { availableVariants, type CollectorVariant } from './collectorData';
import { rarityInfo, type RarityTier } from './rarity';
import { discoveryIdentity } from './unifiedCollection';

/** Boop Coins guide prices, v2. Saved wallets and sale receipts remain v3. */
export const VALUE_VERSION = 2;
export const VALUE_CURRENCY = 'Boop Coins';
export const RARITY_VALUE_MULTIPLIERS: Readonly<Record<RarityTier, number>> = {
  common: 1, uncommon: 2, rare: 5, epic: 12, legendary: 30, mythic: 80, secret: 250,
};
export const FORM_VALUE_MULTIPLIERS: Readonly<Record<CollectorVariant, number>> = {
  normal: 1, shiny: 4, holo: 6, celestial: 10, glitch: 15,
};
export const VALUE_FORM_LABELS: Readonly<Record<CollectorVariant, string>> = {
  normal: 'Standard', shiny: 'Shiny', holo: 'Holo', celestial: 'Celestial', glitch: 'Glitch',
};
const FORMS: readonly CollectorVariant[] = ['normal','shiny','holo','celestial','glitch'];

/** A finite graph of canonical crafting recipes provides an objective,
 * device-independent difficulty measure. Generated recipes aren't trusted
 * for prices: they're player-controlled, and two players could have different
 * paths to the same concept. */
function canonicalDepths(): Map<string,number> {
  const depth = new Map<string,number>(STARTER_ELEMENTS.map(item=>[discoveryIdentity(item.name),0] as const));
  for(let pass=0;pass<32;pass++){
    let changed=false;
    for(const [pair, outcome] of Object.entries(CANONICAL_INFINITE_CRAFT_RECIPES)){
      const [a,b]=pair.split(':::');
      const da=depth.get(a),db=depth.get(b);
      if(da===undefined||db===undefined)continue;
      const result=discoveryIdentity(outcome.result);
      const candidate=Math.min(32,Math.max(da,db)+1);
      if(depth.get(result)===undefined || candidate<depth.get(result)!){
        depth.set(result,candidate);changed=true;
      }
    }
    if(!changed)break;
  }
  return depth;
}
const DEPTHS=canonicalDepths();
const stableNameHash=(key:string)=>{
  let hash=2166136261;
  for(const cp of key)hash=Math.imul(hash ^ cp.codePointAt(0)!,16777619)>>>0;
  return hash;
};
export interface ValueCriteria {
  words:number;
  nameLength:number;
  category:string;
  canonicalSteps:number|null;
  identityBonus:number;
  complexityBonus:number;
  categoryBonus:number;
  pathBonus:number;
}
export function elementValueCriteria(name:string):ValueCriteria {
  const key=discoveryIdentity(name);
  const words=Math.min(3,key.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length||1);
  const nameLength=Math.min(48,[...key].length);
  const category=categoryForDiscovery({name:key});
  const index=COLLECTION_CATEGORY_ORDER.indexOf(category as typeof COLLECTION_CATEGORY_ORDER[number]);
  const categoryBonus=index>=0 ? 7+index*9 : 0;
  const canonicalSteps=DEPTHS.get(key)??null;
  return {words,nameLength,category,canonicalSteps,
    complexityBonus:words*25+nameLength*3,
    categoryBonus,pathBonus:canonicalSteps===null?0:Math.min(canonicalSteps,32)*28,
    identityBonus:stableNameHash(key)%4093,
  };
}
/** Unlike the old 10–40 coin price band, the base uses recognizable
 * complexity/category/known crafting-depth criteria and a stable concept-
 * identity tie breaker. It never uses user IDs, craft counts, art or time. */
export function baseElementValue(name:string):number {
  const c=elementValueCriteria(name);
  return 25+c.complexityBonus+c.categoryBonus+c.pathBonus+c.identityBonus;
}

/** Keys include the normalized *concept*, not a mutable or account-local ID.
 * All five forms are priced up-front, even while locked, so unlocking one
 * does not create a collision with an already quoted value. */
export function elementValueKey(name:string,form:CollectorVariant):string {
  return JSON.stringify([discoveryIdentity(name),form]);
}
export type CollectionValueBook=ReadonlyMap<string,number>;

/** Guaranteed distinct coin quotes for all distinct concept/form combinations
 * in the current saved collection. Equal names are one canonical discovery.
 * Resolve the rare same-price collision by a deterministic, sorted +1 coin
 * probe. Stable during reorder/filter/search; a new colliding discovery or a
 * rarity upgrade can reprice the affected entries, so sales always recheck. */
export function buildCollectionValueBook(elements:readonly InfiniteElement[]):CollectionValueBook {
  const unique=new Map<string,InfiniteElement>();
  for(const item of elements){
    if(!item?.name)continue;
    const id=discoveryIdentity(item.name);
    if(!id)continue;
    const old=unique.get(id);
    if(!old || RARITY_VALUE_MULTIPLIERS[rarityInfo(item.rarityTier).id]>
      RARITY_VALUE_MULTIPLIERS[rarityInfo(old.rarityTier).id])unique.set(id,item);
  }
  const raw=[...unique.values()].flatMap(element=>{
    const base=baseElementValue(element.name);
    const tier=RARITY_VALUE_MULTIPLIERS[rarityInfo(element.rarityTier).id];
    return FORMS.map(form=>({key:elementValueKey(element.name,form),
      coins:base*tier*FORM_VALUE_MULTIPLIERS[form]}));
  });
  raw.sort((a,b)=>a.coins-b.coins||a.key.localeCompare(b.key));
  const book=new Map<string,number>();
  const assigned=new Set<number>();
  for(const entry of raw){
    let coins=entry.coins;
    while(assigned.has(coins))coins++;
    if(!Number.isSafeInteger(coins))throw new Error('Element value range exceeded.');
    book.set(entry.key,coins);
    assigned.add(coins);
  }
  return book;
}

export function elementValue(
  element:InfiniteElement,
  requested:CollectorVariant|'best'='best',
  valueBook?:CollectionValueBook,
) {
  const owned=availableVariants(element);
  const best=owned.reduce((winner,form)=>
    FORM_VALUE_MULTIPLIERS[form]>FORM_VALUE_MULTIPLIERS[winner]?form:winner,'normal');
  const variant=requested==='best'?best:owned.includes(requested)?requested:'normal';
  const rarity=rarityInfo(element.rarityTier);
  const criteria=elementValueCriteria(element.name);
  const baseCoins=25+criteria.complexityBonus+criteria.categoryBonus+criteria.pathBonus+criteria.identityBonus;
  const rarityMultiplier=RARITY_VALUE_MULTIPLIERS[rarity.id];
  const formMultiplier=FORM_VALUE_MULTIPLIERS[variant];
  const rawCoins=baseCoins*rarityMultiplier*formMultiplier;
  const coins=valueBook?.get(elementValueKey(element.name,variant))??rawCoins;
  return {coins,baseCoins,rarityMultiplier,formMultiplier,
    uniquenessAdjustment:coins-rawCoins,criteria,
    variant,rarity:rarity.label,currency:VALUE_CURRENCY,version:VALUE_VERSION};
}
export function formatElementValue(coins:number):string {
  return coins.toLocaleString('en-CA');
}
