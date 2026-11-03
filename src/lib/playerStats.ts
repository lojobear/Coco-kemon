import type { InfiniteElement } from './infiniteCraftData';
import { getCollectionStats, getElementMastery, normalizeElementStats } from './elementStats';
import { STARTER_ELEMENTS } from './infiniteCraftData';

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
  const discoveries = elements.filter(e => !starters.has(e.name.toLowerCase()));
  const shinies = elements.filter(e => e.isShiny || e.unlockedShiny || (e.shinyCraftCount || 0) > 0);
  const firstFinds = discoveries.filter(e => e.isNew);
  const mostCrafted = [...elements].filter(e => (e.craftCount || 0) > 0)
    .sort((a,b) => (b.craftCount || 0)-(a.craftCount || 0)).slice(0, 6);
  const recent = [...discoveries].sort((a,b) => (b.lastCraftedAt || b.discoveredAt || 0)-(a.lastCraftedAt || a.discoveredAt || 0)).slice(0, 5);
  const activity = Array.from({length:7},(_,i)=>{
    const day = new Date(now - (6 - i) * 86400000);
    const key = day.toISOString().slice(0,10);
    const count = elements.filter(e => {
      const timestamp = e.discoveredAt || e.firstCraftedAt || 0;
      return timestamp > 0 && new Date(timestamp).toISOString().slice(0,10) === key;
    }).length;
    return { day: day.toLocaleDateString(undefined,{weekday:'short'}), count };
  });
  const firstAt = discoveries.reduce<number | null>((first,e)=>{
    const stamp=e.discoveredAt || e.firstCraftedAt || 0;
    return stamp > 0 ? (first === null ? stamp : Math.min(first,stamp)) : first;
  },null);
  return { totalElements:elements.length, uniqueDiscoveries:discoveries.length,
    totalCrafts:totals.totalCrafts, shinyVariants:shinies.length, shinyCrafts:totals.totalShinies,
    firstFinds:firstFinds.length, uniqueRecipes:totals.uniqueRecipes, masteredElements:totals.masteredElements,
    highestMastery:mostCrafted.length?getElementMastery(mostCrafted[0].craftCount || 0).label:'Unmade',
    firstAt, recent, mostCrafted, activity };
}
