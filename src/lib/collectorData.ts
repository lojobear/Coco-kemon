import type { InfiniteElement } from './infiniteCraftData';
import { normalizeElementStats } from './elementStats';

export type CollectorVariant = 'normal' | 'shiny' | 'celestial';
export type RoomTheme = 'gallery' | 'night' | 'studio';
export type FrameStyle = 'classic' | 'gold' | 'holo';
export interface TrophySlot {
  name: string;
  variant: CollectorVariant;
  frame: FrameStyle;
}
export interface TrophyRoom {
  theme: RoomTheme;
  slots: Array<TrophySlot | null>;
}
export const TROPHY_SLOTS = 12;
export const DEFAULT_TROPHY_ROOM: TrophyRoom = { theme:'gallery', slots:Array(TROPHY_SLOTS).fill(null) };
export const SHINY_ODDS = 512;
export const CELESTIAL_ODDS = 4096;
export const EVOLUTION_TIERS = [
  { name: 'Discovered', minimumCrafts: 1, minimumRecipes: 0, marker:'✦' },
  { name: 'Awakened', minimumCrafts: 5, minimumRecipes: 0, marker:'❋' },
  { name: 'Ascended', minimumCrafts: 20, minimumRecipes: 2, marker:'✧' },
  { name: 'Legendary', minimumCrafts: 50, minimumRecipes: 3, marker:'✶' },
] as const;

export const ALBUM_SETS = [
  { id:'ocean', title:'Deep Ocean', subtitle:'Beneath the surface', emoji:'🐚', names:['Water','Ocean','Sea','Coral','Fish','Shark','Whale','Pearl'] },
  { id:'technology', title:'Lost Technology', subtitle:'Strange inventions', emoji:'📻', names:['Electricity','Robot','Computer','Internet','Satellite','Time Machine','Laser','Rocket'] },
  { id:'food', title:'Impossible Foods', subtitle:'An unusual menu', emoji:'🍰', names:['Bread','Cake','Pizza','Chocolate','Sushi','Ice Cream','Soup','Burger'] },
  { id:'cryptids', title:'Cryptids & Legends', subtitle:'The almost impossible', emoji:'🦄', names:['Dragon','Unicorn','Phoenix','Mermaid','Vampire','Werewolf','Ghost','Kraken'] },
  { id:'sky', title:'Above the Clouds', subtitle:'Weather and wonders', emoji:'☁️', names:['Wind','Cloud','Rain','Rainbow','Storm','Lightning','Snow','Aurora'] },
  { id:'nature', title:'Whispering Forest', subtitle:'Things that grow', emoji:'🌿', names:['Earth','Tree','Forest','Flower','Mushroom','Butterfly','Fox','Bear'] },
] as const;

/** Milestones are computed from existing persisted craft counts / recipe history. */
export function evolutionFor(element: InfiniteElement) {
  const normalized = normalizeElementStats(element);
  const crafts = normalized.craftCount || 0;
  const recipes = new Set(normalized.recipeHistory?.map(r =>
    [r.first.trim().toLowerCase(),r.second.trim().toLowerCase()].sort().join(':::'))).size;
  let current: typeof EVOLUTION_TIERS[number] = EVOLUTION_TIERS[0];
  for (const tier of EVOLUTION_TIERS) if (crafts >= tier.minimumCrafts && recipes >= tier.minimumRecipes) current = tier;
  const index = EVOLUTION_TIERS.findIndex(t => t.name === current.name);
  const next = EVOLUTION_TIERS[index+1] ?? null;
  return { tier:current, level:index, next, crafts, recipes,
    progress:next ? Math.min(100, Math.round(100*Math.min(crafts/next.minimumCrafts,
      next.minimumRecipes ? recipes/next.minimumRecipes : 1))) : 100 };
}

export function availableVariants(element: InfiniteElement): CollectorVariant[] {
  const variants:CollectorVariant[]=['normal'];
  if (element.unlockedShiny || element.isShiny || (element.shinyCraftCount || 0)>0) variants.push('shiny');
  if (element.unlockedCelestial) variants.push('celestial');
  return variants;
}

export function rollCelestial(random: () => number = Math.random): boolean {
  return Math.floor(random()*CELESTIAL_ODDS) === 0;
}

export function albumSetProgress(elements: readonly InfiniteElement[], names: readonly string[]) {
  const found = new Set(elements.map(e=>e.name.trim().toLowerCase()));
  const count=names.filter(name=>found.has(name.toLowerCase())).length;
  return { count, total:names.length, complete:count===names.length };
}

export function sanitizeTrophyRoom(raw: unknown, owned: readonly InfiniteElement[]): TrophyRoom {
  const fallback = (): TrophyRoom => ({theme:'gallery', slots:Array(TROPHY_SLOTS).fill(null)});
  if (!raw || typeof raw !== 'object') return fallback();
  const data=raw as Partial<TrophyRoom>;
  const theme: RoomTheme = data.theme === 'night'||data.theme === 'studio' ? data.theme : 'gallery';
  const names=new Map(owned.map(e=>[e.name.trim().toLowerCase(),e]));
  const slots=Array.from({length:TROPHY_SLOTS},(_,i):TrophySlot|null=>{
    const item=Array.isArray(data.slots)?data.slots[i]:null;
    if (!item || typeof item.name!=='string' || item.name.length>160) return null;
    const found=names.get(item.name.trim().toLowerCase());
    if(!found)return null;
    const variants=availableVariants(found);
    const variant=variants.includes(item.variant)?item.variant:'normal';
    const frame:FrameStyle = item.frame==='gold'||item.frame==='holo'?item.frame:'classic';
    return {name:found.name,variant,frame};
  });
  return {theme,slots};
}
