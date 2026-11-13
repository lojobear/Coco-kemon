import { qualifiedConceptName } from './conceptMeaning';
import { addCraftCopy } from './elementCopies';
/**
 * One two-ingredient crafting engine shared by Craft's board and Foundry MIX.
 * A single API/cache, a single first-discovery check, and one collection
 * ledger for recipe history, rarity and cosmetic finishes. Pure application
 * of a result does not write saves or spend image credits.
 */
import { requestJson } from './api';
import { CANONICAL_INFINITE_CRAFT_RECIPES, makePairKey, validNewElementName, type InfiniteCraftPairResponse, type InfiniteElement } from './infiniteCraftData';
import { PLAYFUL_RECIPES } from './playfulRecipes';
import { BUILT_IN_PAIR_RECIPES } from './builtInPairs';
import { discoveryIdentity } from './unifiedCollection';
import { categoryForDiscovery } from './collectionCategories';
import { generatePhysicalData, rollIsShiny } from './physicalDataEngine';
import { rollCelestial } from './collectorData';
import { rollRarityTier, rollHolo, rollGlitch, bestRarity, type RarityTier } from './rarity';
import { initialCraftStats, recordElementCraft } from './elementStats';

export const SHARED_PAIR_ENGINE = '/api/infinite-craft/pair';

export async function resolveSharedPair(
  first: string, second: string, options: { signal?: AbortSignal } = {},
): Promise<InfiniteCraftPairResponse> {
  const key = makePairKey(first, second);
  // New curated discoveries are instant/offline; the same table is used by
  // the server and bots. Existing trail/culture routes keep their API behavior.
  const local = CANONICAL_INFINITE_CRAFT_RECIPES[key] || (PLAYFUL_RECIPES[key] && BUILT_IN_PAIR_RECIPES[key]);
  const result: InfiniteCraftPairResponse = local
    ? { ...local, isNew: false }
    : await requestJson<InfiniteCraftPairResponse>(
      `${SHARED_PAIR_ENGINE}?first=${encodeURIComponent(first)}&second=${encodeURIComponent(second)}`,
      { signal: options.signal },
    );
  if (typeof result.result !== 'string' || !validNewElementName(result.result) ||
      typeof result.emoji !== 'string' || !result.emoji.trim() || result.emoji.length > 32 ||
      typeof result.isNew !== 'boolean') {
    throw new Error('The AI produced an invalid or overlong element name. Please retry.');
  }
  return { ...result, result: qualifiedConceptName(result.result, `${result.explanation || ''} ${first} ${second}`) };
}

export interface SharedPairRolls {
  shiny: boolean;
  celestial: boolean;
  holo: boolean;
  glitch: boolean;
  tier: RarityTier;
}

/** Each completed combination uses the same documented odds, in either mode. */
export function rollSharedPair(result: string, first: string, second: string): SharedPairRolls {
  return {
    shiny: rollIsShiny(result, first, second),
    celestial: rollCelestial(),
    holo: rollHolo(),
    glitch: rollGlitch(),
    tier: rollRarityTier(),
  };
}

/** Commit exactly one valid recipe hit to the player's common collection.
 * Caller controls persistence; old items, saved sprites and first dates survive.
 * The isNew field returned by the public API is global, not player-specific. */
export function applySharedPairDiscovery(
  existing: readonly InfiniteElement[],
  outcome: InfiniteCraftPairResponse & { category?: string },
  first: string,
  second: string,
  rolls: SharedPairRolls,
  timestamp = Date.now(),
): { elements: InfiniteElement[]; main: InfiniteElement; bonus?: InfiniteElement; isNew: boolean } {
  const name = qualifiedConceptName(outcome.result, `${outcome.explanation || ''} ${first} ${second}`);
  const emoji = outcome.emoji || '✨';
  const normalized = discoveryIdentity(name);
  const recipe = { first, second };
  const index = existing.findIndex(item => discoveryIdentity(item.name) === normalized);
  const isNew = index < 0;
  const physical = generatePhysicalData(name, emoji, false);
  const shinyPhysical = rolls.shiny ? generatePhysicalData(name, emoji, true) : undefined;
  const copyForm = rolls.glitch ? 'glitch' : rolls.celestial ? 'celestial' : rolls.holo ? 'holo' : rolls.shiny ? 'shiny' : 'normal';
  const initial: InfiniteElement = {
    copyCounts: addCraftCopy(undefined, copyForm),
    id: normalized.replace(/[^a-z0-9]/g, '_') || `discovery_${timestamp}`,
    name, emoji,
    category: categoryForDiscovery({ name, category: outcome.category, connection: outcome.connection }),
    discoveredAt: timestamp,
    isNew, explanation: outcome.explanation,
    connection: outcome.connection,
    recipe,
    isShiny: rolls.shiny,
    unlockedShiny: rolls.shiny,
    shinyDiscoveredAt: rolls.shiny ? timestamp : undefined,
    shinyTitle: shinyPhysical?.shinyTitle,
    unlockedCelestial: rolls.celestial,
    celestialDiscoveredAt: rolls.celestial ? timestamp : undefined,
    unlockedHolo: rolls.holo,
    holoDiscoveredAt: rolls.holo ? timestamp : undefined,
    unlockedGlitch: rolls.glitch,
    glitchDiscoveredAt: rolls.glitch ? timestamp : undefined,
    rarityTier: rolls.tier,
    rarityDiscoveredAt: timestamp,
    physicalData: physical,
    ...initialCraftStats(recipe, rolls.shiny, timestamp),
  };
  let main = initial;
  const updated = [...existing];
  if (index >= 0) {
    const old = existing[index];
    const tracked = recordElementCraft(old, recipe, rolls.shiny, timestamp);
    const tier = bestRarity(old.rarityTier, rolls.tier);
    main = {
      ...tracked,
      copyCounts: addCraftCopy(old, copyForm),
      explanation: old.explanation || outcome.explanation,
      connection: old.connection || outcome.connection,
      category: old.category || initial.category,
      recipe: old.recipe || recipe,
      unlockedShiny: rolls.shiny || old.unlockedShiny,
      isShiny: rolls.shiny ? true : old.isShiny,
      shinyDiscoveredAt: old.shinyDiscoveredAt || (rolls.shiny ? timestamp : undefined),
      shinyTitle: old.shinyTitle || shinyPhysical?.shinyTitle,
      unlockedCelestial: Boolean(old.unlockedCelestial || rolls.celestial),
      celestialDiscoveredAt: old.celestialDiscoveredAt || (rolls.celestial ? timestamp : undefined),
      unlockedHolo: Boolean(old.unlockedHolo || rolls.holo),
      holoDiscoveredAt: old.holoDiscoveredAt || (rolls.holo ? timestamp : undefined),
      unlockedGlitch: Boolean(old.unlockedGlitch || rolls.glitch),
      glitchDiscoveredAt: old.glitchDiscoveredAt || (rolls.glitch ? timestamp : undefined),
      rarityTier: tier,
      rarityDiscoveredAt: tier !== old.rarityTier ? timestamp : old.rarityDiscoveredAt,
      physicalData: old.physicalData || physical,
      isNew: false,
    };
    updated[index] = main;
  } else {
    updated.unshift(main);
  }

  let bonus: InfiniteElement | undefined;
  const rare = outcome.bonus;
  if (rare && typeof rare.result === 'string' && validNewElementName(rare.result) &&
      typeof rare.emoji === 'string' && rare.emoji.trim() && rare.emoji.length <= 32 &&
      rare.variantOf === name && typeof rare.explanation === 'string' && rare.explanation.length <= 280 &&
      !updated.some(item => discoveryIdentity(item.name) === discoveryIdentity(rare.result))) {
    bonus = {
      copyCounts: addCraftCopy(undefined, 'normal'),
      id: discoveryIdentity(rare.result).replace(/[^a-z0-9]/g, '_') || `bonus_${timestamp}`,
      name: rare.result, emoji: rare.emoji,
      category: categoryForDiscovery({ name: rare.result, connection: 'rare variant' }),
      variantOf: rare.variantOf,
      explanation: rare.explanation,
      connection: 'rare variant',
      recipe, discoveredAt: timestamp,
      isNew: true,
      physicalData: generatePhysicalData(rare.result, rare.emoji, false),
      ...initialCraftStats(recipe, false, timestamp),
    };
    updated.unshift(bonus);
  }
  return { elements: updated, main, bonus, isNew };
}
