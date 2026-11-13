import { arenaCards, type ArenaCard, type ArenaPlayer, type BotDifficulty, type BotProfile } from './arena';
import { STARTER_ELEMENTS, makePairKey, validNewElementName, type InfiniteElement, type InfiniteCraftPairResponse } from './infiniteCraftData';
import { BUILT_IN_PAIR_RECIPES } from './builtInPairs';
import { rollRareVariant } from './discoveryTrails';
import { applySharedPairDiscovery, rollSharedPair, type SharedPairRolls } from './sharedCraftingEngine';
import { collectionDisplayCategory } from './collectionCategories';
import { qualifiedConceptName } from './conceptMeaning';
import { discoveryIdentity } from './unifiedCollection';
import { uniformRandomIndex } from './rarity';

export const BOT_REGISTRY = 'bots:collectors:v1';
export const BOT_SLOT_MS = 600_000;
export const BOT_MAX_ITEMS = 500;
export const BOT_CACHE_READS = 4;
export const BOT_DEFINITIONS = [
  {id:'bot:byte-badger',name:'Byte Badger',avatar:'🦡',difficulty:'Hard',specialty:'Technology, machines & inventions',interval:1,categories:['Technology','Vehicles','Science & Medicine']},
  {id:'bot:pixel-panda',name:'Pixel Panda',avatar:'🐼',difficulty:'Easy',specialty:'Animals, plants & food',interval:3,categories:['Animals','Plants & Nature','Food & Drink']},
  {id:'bot:copper-cat',name:'Copper Cat',avatar:'🐱',difficulty:'Medium',specialty:'Metals, tools & construction',interval:2,categories:['Materials & Minerals','Tools & Objects','Buildings & Structures']},
  {id:'bot:orbit-owl',name:'Orbit Owl',avatar:'🦉',difficulty:'Expert',specialty:'Space, fantasy & mysteries',interval:2,categories:['Space & Cosmos','Fantasy & Mythology','Language & Ideas']},
] as const;
export type BotDefinition = typeof BOT_DEFINITIONS[number];
export interface BotState {
  id:string; items:InfiniteElement[]; crafts:number; lastCraftAt:number|null; lastSlot:number;
  recent:string[]; wins:number; losses:number; draws:number;
}
export interface BotRecipe {first:string; second:string; outcome:InfiniteCraftPairResponse & {category?:string}}
type Draw = (max:number)=>number;
type KnownResult = Omit<InfiniteCraftPairResponse,'isNew'>;
// Same precedence as the shared Craft/Foundry pair endpoint. No network or AI.
const KNOWN:Record<string,KnownResult> = BUILT_IN_PAIR_RECIPES;
const BASE_PATH = [
  ['Water','Fire'],['Water','Earth'],['Fire','Earth'],['Lava','Water'],['Mud','Water'],
  ['Plant','Water'],['Swamp','Fire'],['Earth','Wind'],['Fire','Dust'],['Water','Spark'],
  ['Life','Earth'],['Water','Water'],['Lake','Water'],['Life','Ocean'],['Stone','Fire'],
  ['Steam','Metal'],['Plant','Fire'],['Mud','Fire'],['Brick','Brick'],['Wall','Brick'],
] as const;
const NORMAL:SharedPairRolls={shiny:false,celestial:false,holo:false,glitch:false,tier:'common'};
export function botDefinition(id:string){return BOT_DEFINITIONS.find(bot=>bot.id===id);}
export function knownBotRecipe(first:string,second:string):BotRecipe|undefined {
  const outcome=KNOWN[makePairKey(first,second)];
  return outcome?{first,second,outcome:{...outcome,isNew:false}}:undefined;
}
function ownedMap(state:BotState){return new Map(state.items.map(item=>[discoveryIdentity(item.name),item.name]));}
function resultKey(recipe:BotRecipe){return discoveryIdentity(qualifiedConceptName(recipe.outcome.result,`${recipe.outcome.explanation||''} ${recipe.first} ${recipe.second}`));}
export function eligibleBotRecipes(state:BotState):BotRecipe[] {
  const owned=ownedMap(state);
  return Object.entries(KNOWN).flatMap(([key,outcome])=>{
    const [a,b]=key.split(':::');const first=owned.get(a),second=owned.get(b);
    return first&&second&&validNewElementName(outcome.result)?[{first,second,outcome:{...outcome,isNew:false}}]:[];
  });
}
function preference(def:BotDefinition,recipe:BotRecipe){
  const category=collectionDisplayCategory({name:recipe.outcome.result,category:recipe.outcome.category,connection:recipe.outcome.connection});
  return (def.categories as readonly string[]).includes(category);
}
export function selectKnownBotRecipe(def:BotDefinition,state:BotState,draw:Draw=uniformRandomIndex):BotRecipe|undefined {
  const owned=ownedMap(state),all=eligibleBotRecipes(state);
  const fresh=state.items.length<BOT_MAX_ITEMS?all.filter(recipe=>!owned.has(resultKey(recipe))):[];
  const pool=fresh.length?fresh:all.filter(recipe=>owned.has(resultKey(recipe)));
  const preferred=pool.filter(recipe=>preference(def,recipe));
  const choices=preferred.length&&draw(4)!==0?preferred:pool;
  return choices.length?choices[draw(choices.length)]:undefined;
}
export function applyBotRecipe(state:BotState,recipe:BotRecipe,now:number,rolls?:SharedPairRolls):BotState {
  const owned=ownedMap(state);
  if(!owned.has(discoveryIdentity(recipe.first))||!owned.has(discoveryIdentity(recipe.second)))throw new Error('Bot must own both ingredients.');
  if(!validNewElementName(recipe.outcome.result)||!recipe.outcome.emoji||recipe.outcome.emoji.length>32)throw new Error('Invalid bot recipe.');
  if(state.items.length>=BOT_MAX_ITEMS&&!owned.has(resultKey(recipe)))return state;
  const applied=applySharedPairDiscovery(state.items,{...recipe.outcome,isNew:false,
    bonus:state.items.length<BOT_MAX_ITEMS-1&&!rolls?rollRareVariant(recipe.outcome.result):undefined},
    recipe.first,recipe.second,rolls||rollSharedPair(recipe.outcome.result,recipe.first,recipe.second),now);
  const recent=[discoveryIdentity(applied.main.name),...state.recent.filter(key=>key!==discoveryIdentity(applied.main.name))].slice(0,8);
  return {...state,items:applied.elements,crafts:state.crafts+1,lastCraftAt:now,recent};
}
/** Bootstrap is actual shared-recipe crafting with normal rolls, not gifted rares. */
export function seedBot(def:BotDefinition,now:number):BotState {
  let state:BotState={id:def.id,items:STARTER_ELEMENTS.map(item=>({...item,isStarter:true})),crafts:0,lastCraftAt:null,lastSlot:-1,recent:[],wins:0,losses:0,draws:0};
  for(const [first,second] of BASE_PATH){
    const recipe=knownBotRecipe(first,second);
    if(!recipe)throw new Error('Missing bootstrap recipe: '+first+' + '+second);
    state=applyBotRecipe(state,recipe,now,NORMAL);
  }
  for(let i=0;i<10;i++){
    const owned=ownedMap(state);
    const fresh=eligibleBotRecipes(state).filter(recipe=>!owned.has(resultKey(recipe)));
    const preferred=fresh.filter(recipe=>preference(def,recipe));
    const choices=preferred.length?preferred:fresh;
    if(!choices.length)break;
    const index=(i+BOT_DEFINITIONS.indexOf(def))%choices.length;
    state=applyBotRecipe(state,choices[index],now,NORMAL);
  }
  return state;
}
export function botDue(def:BotDefinition,state:BotState,slot:number):boolean {
  return Number.isSafeInteger(slot)&&slot>=0&&slot>state.lastSlot&&slot%def.interval===0;
}
/** Bounded read-only probes of already cached human results. Misses never generate AI. */
export function botCacheCandidates(state:BotState,draw:Draw=uniformRandomIndex):{first:string;second:string;key:string}[]{
  if(state.items.length>=BOT_MAX_ITEMS)return [];
  const result:{first:string;second:string;key:string}[]=[];const used=new Set<string>();
  for(let i=0;i<24&&result.length<BOT_CACHE_READS;i++){
    const first=state.items[draw(state.items.length)].name,second=state.items[draw(state.items.length)].name;
    const key=makePairKey(first,second);
    if(KNOWN[key]||used.has(key))continue;
    used.add(key);result.push({first,second,key});
  }
  return result;
}
export function cachedBotRecipe(first:string,second:string,value:unknown):BotRecipe|undefined {
  if(!value||typeof value!=='object')return;
  const v=value as Partial<KnownResult>;
  if(typeof v.result!=='string'||!validNewElementName(v.result)||typeof v.emoji!=='string'||!v.emoji.trim()||v.emoji.length>32)return;
  return {first,second,outcome:{result:v.result,emoji:v.emoji,isNew:false,
    explanation:typeof v.explanation==='string'?v.explanation.slice(0,280):undefined,
    connection:typeof v.connection==='string'?v.connection.slice(0,80):undefined}};
}
export function botProfile(def:BotDefinition,state:BotState):BotProfile{
  const cards=arenaCards(state.items),byKey=new Map(cards.map(card=>[card.key,card]));
  return {id:def.id,name:def.name,avatar:def.avatar,difficulty:def.difficulty,specialty:def.specialty,
    level:1+Math.floor(state.crafts/10),crafts:state.crafts,discoveries:state.items.filter(item=>!item.isStarter).length,
    shinies:state.items.filter(item=>item.isShiny||item.unlockedShiny).length,
    wins:state.wins,losses:state.losses,draws:state.draws,lastCraftAt:state.lastCraftAt,cards,
    recent:state.recent.flatMap(key=>byKey.has(key)?[byKey.get(key)!]:[])};
}
export function botOpponent(def:BotDefinition,state:BotState,category:string):ArenaPlayer|null{
  const profile=botProfile(def,state);const cards=profile.cards.filter(card=>card.category===category);
  return cards.length?{id:def.id,name:def.name,avatar:def.avatar,difficulty:def.difficulty,level:profile.level,bot:true,cards}:null;
}
export function chooseBotCard(cards:ArenaCard[],difficulty:BotDifficulty='Medium',draw:Draw=uniformRandomIndex):ArenaCard {
  const sorted=[...cards].sort((a,b)=>a.coins-b.coins||a.key.localeCompare(b.key));
  if(!sorted.length)throw new Error('Bot has no eligible card.');
  const n=sorted.length;
  const pool=difficulty==='Easy'?sorted.slice(0,Math.max(1,Math.ceil(n/2))):
    difficulty==='Hard'?sorted.slice(Math.floor(n*2/3)):
    difficulty==='Expert'?sorted.slice(Math.max(0,n-2)):sorted;
  return pool[draw(pool.length)];
}
