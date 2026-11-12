import type { InfiniteElement } from './infiniteCraftData';
import { collectionDisplayCategory } from './collectionCategories';
import { buildCollectionValueBook, elementValue } from './elementValue';
import { discoveryIdentity } from './unifiedCollection';
import { displayConceptName } from './conceptMeaning';
export interface ArenaCard { key: string; name: string; emoji: string; category: string; coins: number; form: string }
export interface ArenaPlayer { id: string; name: string; bot: boolean; cards: ArenaCard[] }
export interface ArenaView {
  phase: 'waiting'|'picking'|'finished'; category: string; room?: string; deadline?: number; botAt?: number;
  waiting?: number; cards?: ArenaCard[]; locked?: boolean; opponent?: { name: string; bot: boolean; locked: boolean };
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
export const BOT_NAMES = ['Byte Badger', 'Pixel Panda', 'Copper Cat', 'Orbit Owl'];
export function botCards(category: string): ArenaCard[] {
  const names = ['Fox','Whale','Dragon','Pizza','Coffee','Cake','Tree','Rose','Mushroom','Storm','Cloud','Rain','Water','Fire','Steam','Biochar','Gold','Diamond','Robot','Computer','Camera','Hammer','Smoker (barbecue)','Telescope','Car','Train','Boat','Castle','House','Bridge','Ocean','Mountain','Island','Moon','Galaxy','Rocket','Doctor','Chef','Pirate','Pikachu','Mario','Batman','Nintendo','Lego','Minecraft','Wizard','Unicorn','Phoenix','Guitar','Piano','Bass (instrument)','Dream','Memory','Time','Oddkin'];
  return arenaCards(names.map((name,i) => ({ id:`bot-${i}`, name, emoji:'🤖', rarityTier: i%7===0 ? 'rare' : i%3===0 ? 'uncommon' : 'common' }))).filter(card => card.category === category);
}
