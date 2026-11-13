import { STARTER_ELEMENTS, makePairKey, type InfiniteElement } from './infiniteCraftData';
import { BUILT_IN_PAIR_RECIPES } from './builtInPairs';
import { cachedBotRecipe, knownBotRecipe, type BotRecipe } from './botCollectors';
import { applySharedPairDiscovery, rollSharedPair } from './sharedCraftingEngine';
import { rollRareVariant } from './discoveryTrails';
import { qualifiedConceptName } from './conceptMeaning';
import { discoveryIdentity } from './unifiedCollection';
import { uniformRandomIndex } from './rarity';

export const BLOOP_SLOT_MS = 15 * 60_000;
export const BLOOP_MAX_ITEMS = 5000;
export const BLOOP_CACHE_PROBES = 4;
export type BloopState = {id:'bloop';items:InfiniteElement[];crafts:number;lastCraftAt:number|null;artwork:Record<string,'ready'|'pending'>;imageDay?:string;imageNeuronsUsed?:number};
export type BloopActivity = {status:'crafted'|'idle'|'failed';strategy?:'random'|'curious';first?:string;second?:string;result?:string;isNew?:boolean;rarity?:string;artwork?:'ready'|'pending'|'none';message?:string};
export const newBloopState=():BloopState=>({id:'bloop',items:STARTER_ELEMENTS.map(x=>({...x,isStarter:true})),crafts:0,lastCraftAt:null,artwork:{}});
export const bloopSlot=(now:number)=>Math.floor(now/BLOOP_SLOT_MS);
type Draw=(max:number)=>number;
type Lookup=(key:string)=>Promise<unknown>;
const knownResult=(r:BotRecipe)=>discoveryIdentity(qualifiedConceptName(r.outcome.result,`${r.outcome.explanation||''} ${r.first} ${r.second}`));
export async function chooseBloopRecipe(state:BloopState,lookup:Lookup,draw:Draw=uniformRandomIndex):Promise<{recipe?:BotRecipe;strategy:'random'|'curious'}>{
  const strategy=draw(2)===0?'random':'curious';
  const owned=new Map(state.items.map(x=>[discoveryIdentity(x.name),x.name]));
  const all=Object.keys(BUILT_IN_PAIR_RECIPES).flatMap(key=>{
    const [a,b]=key.split(':::');const first=owned.get(a),second=owned.get(b);
    const recipe=first&&second?knownBotRecipe(first,second):undefined;
    return recipe?[recipe]:[];
  });
  const canUse=(recipe:BotRecipe)=>state.items.length<BLOOP_MAX_ITEMS||owned.has(knownResult(recipe));
  const fresh=all.filter(r=>canUse(r)&&!owned.has(knownResult(r)));
  if(strategy==='random'||!fresh.length){
    const seen=new Set<string>();
    for(let i=0;i<BLOOP_CACHE_PROBES;i++){
      if(!state.items.length)break;
      const first=state.items[draw(state.items.length)].name,second=state.items[draw(state.items.length)].name;
      const key=makePairKey(first,second);if(seen.has(key))continue;seen.add(key);
      const known=knownBotRecipe(first,second);
      if(known&&canUse(known))return {recipe:known,strategy};
      // Random exploration reuses the game's real cached AI discoveries. A cache
      // miss must not start an unmetered text-provider request.
      try{const hit=cachedBotRecipe(first,second,await lookup(key));if(hit&&canUse(hit))return {recipe:hit,strategy};}catch{/* use known recipes */}
    }
  }
  const pool=fresh.length?fresh:all.filter(canUse);
  return {recipe:pool.length?pool[draw(pool.length)]:undefined,strategy};
}
export function applyBloopRecipe(state:BloopState,recipe:BotRecipe,now:number):{state:BloopState;detail:BloopActivity}{
  const owned=new Set(state.items.map(x=>discoveryIdentity(x.name)));
  if(!owned.has(discoveryIdentity(recipe.first))||!owned.has(discoveryIdentity(recipe.second)))throw new Error('Bloop must own its ingredients.');
  if(state.items.length>=BLOOP_MAX_ITEMS&&!owned.has(knownResult(recipe)))return {state,detail:{status:'idle',message:'Collection limit reached'}};
  const result=applySharedPairDiscovery(state.items,{...recipe.outcome,isNew:false,bonus:state.items.length<BLOOP_MAX_ITEMS-1?rollRareVariant(recipe.outcome.result):undefined},recipe.first,recipe.second,rollSharedPair(recipe.outcome.result,recipe.first,recipe.second),now);
  const artwork={...state.artwork};
  for(const item of [result.main,result.bonus])if(item&&!item.isStarter&&!artwork[discoveryIdentity(item.name)])artwork[discoveryIdentity(item.name)]='pending';
  return {state:{...state,items:result.elements,artwork,crafts:state.crafts+1,lastCraftAt:now},detail:{status:'crafted',first:recipe.first,second:recipe.second,result:result.main.name,isNew:result.isNew,rarity:result.main.rarityTier||'common'}};
}
