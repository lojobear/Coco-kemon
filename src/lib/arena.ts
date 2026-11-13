import type { InfiniteElement } from './infiniteCraftData';
import { collectionDisplayCategory } from './collectionCategories';
import { buildCollectionValueBook, elementValue } from './elementValue';
import { discoveryIdentity } from './unifiedCollection';
import { displayConceptName } from './conceptMeaning';
export interface ArenaCard { key: string; name: string; emoji: string; category: string; coins: number; form: string }
export type BotDifficulty = 'Easy'|'Medium'|'Hard'|'Expert';
export interface BotProfile {
  id:string; name:string; avatar:string; difficulty:BotDifficulty; specialty:string;
  level:number; crafts:number; discoveries:number; shinies:number; wins:number; losses:number; draws:number;
  lastCraftAt:number|null; cards:ArenaCard[]; recent:ArenaCard[];
}
export interface ArenaPlayer { id: string; name: string; bot: boolean; cards: ArenaCard[]; difficulty?:BotDifficulty; avatar?:string; level?:number }
export interface ArenaView {
  phase: 'waiting'|'picking'|'finished'; category: string; room?: string; deadline?: number; botAt?: number;
  waiting?: number; botUnavailable?:boolean; cards?: ArenaCard[]; locked?: boolean; opponent?: { name: string; bot: boolean; locked: boolean; difficulty?:BotDifficulty; avatar?:string; level?:number };
  picks?: { you: ArenaCard|null; opponent: ArenaCard|null }; result?: 'win'|'loss'|'draw'; reason?: string;
}
export function arenaCards(items: InfiniteElement[]): ArenaCard[] {
  const seen = new Set<string>();
  const valid = items.filter(item => item && typeof item.name === 'string' && item.name.trim() && item.name.length <= 160 && !seen.has(discoveryIdentity(item.name)) && !!seen.add(discoveryIdentity(item.name)));
  const book = buildCollectionValueBook(valid);
  return valid.map(item => {
    const value = elementValue(item, 'best', book);
    const name = displayConceptName(item);
    return { key: discoveryIdentity(item.name), name, emoji: typeof item.emoji === 'string' ? item.emoji.slice(0,32) : '✨', category: collectionDisplayCategory({ ...item, name }), coins: value.coins, form: value.variant };
  });
}
