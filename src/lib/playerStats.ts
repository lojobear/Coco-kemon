import type { InfiniteElement } from './infiniteCraftData';
import { getCollectionStats, getElementMastery, normalizeElementStats } from './elementStats';
import { isSuppliedStarter } from './starterIdentity';
import { STARTER_ELEMENTS } from './infiniteCraftData';
import { collectionCategoryCounts } from './collectionCategories';
import { buildCollectionValueBook, elementValue } from './elementValue';
import { availableVariants } from './collectorData';
import { RARITY_TIERS, rarityInfo } from './rarity';

const discoveryTime = (e: InfiniteElement) => e.discoveredAt || e.firstCraftedAt || 0;
const localDay = (stamp: number) => { const d = new Date(stamp); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** Local-account collection metrics. Counts are explicitly not global leaderboard ranks. */
export function playerCraftStats(items: readonly InfiniteElement[], now = Date.now()) {
  const seen = new Set<string>();
  const elements = items.filter(e => {
    const name = e?.name?.trim().toLowerCase();
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  }).map(normalizeElementStats);
  const totals = getCollectionStats(elements);
  const starters = new Set(STARTER_ELEMENTS.map(e => e.name.toLowerCase()));
  const discoveries = elements.filter(e => !isSuppliedStarter(e) && !starters.has(e.name.toLowerCase()));
  const shinies = elements.filter(e => e.isShiny || e.unlockedShiny || (e.shinyCraftCount || 0) > 0);
  const firstFinds = discoveries.filter(e => e.isNew);
  const mostCrafted = [...elements].filter(e => (e.craftCount || 0) > 0)
    .sort((a,b) => (b.craftCount || 0)-(a.craftCount || 0)).slice(0, 6);
  const recent = discoveries.filter(e => (e.discoveredAt || e.firstCraftedAt || 0) > 0).sort((a,b) => discoveryTime(b)-discoveryTime(a)).slice(0, 5);
  const activity = Array.from({length:7},(_,i)=>{
    const day = new Date(now);
    day.setDate(day.getDate() - (6 - i));
    const key = localDay(day.getTime());
    const count = discoveries.filter(e => {
      const timestamp = e.discoveredAt || e.firstCraftedAt || 0;
      return timestamp > 0 && localDay(timestamp) === key;
    }).length;
    return { day: day.toLocaleDateString(undefined,{weekday:'short'}), count };
  });
  const firstAt = discoveries.reduce<number | null>((first,e)=>{
    const stamp=e.discoveredAt || e.firstCraftedAt || 0;
    return stamp > 0 ? (first === null ? stamp : Math.min(first,stamp)) : first;
  },null);
  const categories = collectionCategoryCounts(discoveries).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name));
  const rarities = RARITY_TIERS.map(tier => ({ name: tier.label, count: discoveries.filter(e => rarityInfo(e.rarityTier).id === tier.id).length }));
  const valueBook = buildCollectionValueBook(elements);
  const valued = discoveries.map(element => ({ element, coins: elementValue(element, 'best', valueBook).coins }))
    .sort((a,b) => b.coins-a.coins || a.element.name.localeCompare(b.element.name));
  const unlockedForms = discoveries.reduce((count,e) => count + availableVariants(e).length - 1, 0);
  const milestones = [
    { name: 'First discovery', target: 1, current: discoveries.length, unit: 'discoveries' },
    { name: 'Curious collector', target: 25, current: discoveries.length, unit: 'discoveries' },
    { name: 'Century collection', target: 100, current: discoveries.length, unit: 'discoveries' },
    { name: 'Across the shelves', target: 10, current: categories.length, unit: 'categories' },
    { name: 'Busy workshop', target: 100, current: totals.totalCrafts, unit: 'crafts' },
    { name: 'A little sparkle', target: 1, current: shinies.length, unit: 'shiny elements' },
  ].map(m => ({ ...m, unlocked: m.current >= m.target }));
  return { categories, rarities, unlockedForms, milestones,
    // A guide quote for one best unlocked form per discovery, not saleable inventory or wallet balance.
    collectionGuideValue: valued.reduce((sum,e) => sum+e.coins, 0),
    mostValuable: valued.slice(0,5), discoveries,
    totalElements:elements.length, uniqueDiscoveries:discoveries.length,
    totalCrafts:totals.totalCrafts, shinyVariants:shinies.length, shinyCrafts:totals.totalShinies,
    firstFinds:firstFinds.length, uniqueRecipes:totals.uniqueRecipes, masteredElements:totals.masteredElements,
    highestMastery:mostCrafted.length?getElementMastery(mostCrafted[0].craftCount || 0).label:'Unmade',
    firstAt, recent, mostCrafted, activity };
}
