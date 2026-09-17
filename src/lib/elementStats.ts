import type { InfiniteElement } from './infiniteCraftData';

export interface ElementMastery {
  level: number;
  label: 'Unmade' | 'Discovered' | 'Familiar' | 'Adept' | 'Master' | 'Legendary';
  currentFloor: number;
  nextTarget: number | null;
  progress: number;
}

export interface CraftCollectionStats {
  totalCrafts: number;
  totalShinies: number;
  masteredElements: number;
  uniqueRecipes: number;
}

const cleanCount = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

const recipeKey = (first: string, second: string) =>
  [first.trim().toLowerCase(), second.trim().toLowerCase()].sort().join(':::');

export function normalizeElementStats(element: InfiniteElement): InfiniteElement {
  const legacyMinimum = element.discoveredAt || element.recipe || element.isNew ? 1 : 0;
  const craftCount = cleanCount(element.craftCount, legacyMinimum);
  const shinyCraftCount = cleanCount(
    element.shinyCraftCount,
    element.unlockedShiny || element.isShiny ? 1 : 0
  );
  const recipeHistory = Array.isArray(element.recipeHistory)
    ? element.recipeHistory
        .filter(r => r && typeof r.first === 'string' && typeof r.second === 'string')
        .map(r => ({
          first: r.first,
          second: r.second,
          count: Math.max(1, cleanCount(r.count, 1)),
          firstSeenAt: cleanCount(r.firstSeenAt, element.discoveredAt || Date.now()),
          lastSeenAt: cleanCount(r.lastSeenAt, element.discoveredAt || Date.now()),
        }))
        .slice(0, 12)
    : element.recipe
      ? [{
          first: element.recipe.first,
          second: element.recipe.second,
          count: Math.max(1, craftCount),
          firstSeenAt: element.discoveredAt || Date.now(),
          lastSeenAt: element.discoveredAt || Date.now(),
        }]
      : [];

  return {
    ...element,
    craftCount,
    shinyCraftCount,
    firstCraftedAt: element.firstCraftedAt || element.discoveredAt,
    lastCraftedAt: element.lastCraftedAt || element.discoveredAt,
    recipeHistory,
  };
}

export function initialCraftStats(
  recipe: { first: string; second: string } | undefined,
  isShiny: boolean,
  timestamp = Date.now()
): Pick<InfiniteElement, 'craftCount' | 'shinyCraftCount' | 'firstCraftedAt' | 'lastCraftedAt' | 'recipeHistory'> {
  return {
    craftCount: 1,
    shinyCraftCount: isShiny ? 1 : 0,
    firstCraftedAt: timestamp,
    lastCraftedAt: timestamp,
    recipeHistory: recipe
      ? [{ first: recipe.first, second: recipe.second, count: 1, firstSeenAt: timestamp, lastSeenAt: timestamp }]
      : [],
  };
}

export function recordElementCraft(
  element: InfiniteElement,
  recipe: { first: string; second: string },
  isShiny: boolean,
  timestamp = Date.now()
): InfiniteElement {
  const current = normalizeElementStats(element);
  const key = recipeKey(recipe.first, recipe.second);
  const existingHistory = [...(current.recipeHistory || [])];
  const matchIndex = existingHistory.findIndex(r => recipeKey(r.first, r.second) === key);

  if (matchIndex >= 0) {
    const previous = existingHistory[matchIndex];
    existingHistory[matchIndex] = {
      ...previous,
      count: Math.max(1, previous.count || 1) + 1,
      lastSeenAt: timestamp,
    };
  } else {
    existingHistory.push({
      first: recipe.first,
      second: recipe.second,
      count: 1,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
    });
  }

  existingHistory.sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  return {
    ...current,
    craftCount: (current.craftCount || 0) + 1,
    shinyCraftCount: (current.shinyCraftCount || 0) + (isShiny ? 1 : 0),
    firstCraftedAt: current.firstCraftedAt || timestamp,
    lastCraftedAt: timestamp,
    recipeHistory: existingHistory.slice(0, 12),
  };
}

export function getElementMastery(craftCount = 0): ElementMastery {
  const count = Math.max(0, Math.floor(craftCount));
  const tiers = [
    { floor: 0, next: 1, level: 0, label: 'Unmade' as const },
    { floor: 1, next: 5, level: 1, label: 'Discovered' as const },
    { floor: 5, next: 10, level: 2, label: 'Familiar' as const },
    { floor: 10, next: 25, level: 3, label: 'Adept' as const },
    { floor: 25, next: 50, level: 4, label: 'Master' as const },
    { floor: 50, next: null, level: 5, label: 'Legendary' as const },
  ];
  const tier = [...tiers].reverse().find(t => count >= t.floor) || tiers[0];
  const progress = tier.next === null
    ? 100
    : Math.max(0, Math.min(100, ((count - tier.floor) / (tier.next - tier.floor)) * 100));
  return { level: tier.level, label: tier.label, currentFloor: tier.floor, nextTarget: tier.next, progress };
}

export function getCollectionStats(elements: InfiniteElement[]): CraftCollectionStats {
  return elements.reduce<CraftCollectionStats>((stats, raw) => {
    const element = normalizeElementStats(raw);
    stats.totalCrafts += element.craftCount || 0;
    stats.totalShinies += element.shinyCraftCount || 0;
    stats.uniqueRecipes += element.recipeHistory?.length || 0;
    if (getElementMastery(element.craftCount || 0).level >= 4) stats.masteredElements += 1;
    return stats;
  }, { totalCrafts: 0, totalShinies: 0, masteredElements: 0, uniqueRecipes: 0 });
}

export function formatCraftDate(timestamp?: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}