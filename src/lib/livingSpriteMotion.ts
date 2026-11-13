import { collectionDisplayCategory } from './collectionCategories';
export type LivingMotion = 'creature'|'liquid'|'flame'|'plant'|'machine'|'vehicle'|'orbit'|'ghost'|'weather'|'crystal'|'object';
/** Semantic, deterministic, no AI or image changes. A subject noun takes
 * precedence over its ingredient/modifier (Fire Truck is a vehicle). */
export function livingSpriteMotion(name:string,category?:string):LivingMotion {
  const clean=name.normalize('NFKC').trim().toLowerCase();
  const shelf=collectionDisplayCategory({name,category});
  if (/\b(?:ghost|specter|spectre|phantom|spirit|wraith|poltergeist|apparition)$/.test(clean)) return 'ghost';
  if (shelf==='Animals'||shelf==='Oddkin & Creatures'||shelf==='Characters'||shelf==='People & Professions'||
      /\b(?:dragon|unicorn|phoenix|mermaid|griffin|goblin|wizard|witch|fairy|troll|elf|vampire|werewolf|kraken|leviathan)$/.test(clean)) return 'creature';
  if (shelf==='Vehicles') return 'vehicle';
  if (shelf==='Technology'||/\b(?:engine|motor|gear|machine|circuit|turbine|mechanism|automaton)$/.test(clean)) return 'machine';
  if (shelf==='Plants & Nature') return 'plant';
  if (/\b(?:water|wave|ocean|sea|river|lake|liquid|droplet|puddle|waterfall|geyser|juice|syrup)$/.test(clean)) return 'liquid';
  if (/\b(?:fire|flame|flames|lava|magma|ember|embers|spark|inferno|plasma|campfire|bonfire)$/.test(clean)) return 'flame';
  if (shelf==='Space & Cosmos') return 'orbit';
  if (shelf==='Weather & Climate'||/\b(?:steam|smoke|vapor|vapour|mist|fog|wind|cloud)$/.test(clean)) return 'weather';
  if (/\b(?:crystal|diamond|ruby|emerald|sapphire|quartz|gem|gemstone|opal|amethyst|glass|ice)$/.test(clean)) return 'crystal';
  return 'object';
}
