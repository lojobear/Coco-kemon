import type { InfiniteElement } from './infiniteCraftData';
import { availableVariants, type CollectorVariant } from './collectorData';
import { rarityInfo, type RarityTier } from './rarity';
import { discoveryIdentity } from './unifiedCollection';

/** In-game guide prices, version 1. Never trust a client quote to authorize a future transaction. */
export const VALUE_VERSION = 1;
export const VALUE_CURRENCY = 'Boop Coins';
export const RARITY_VALUE_MULTIPLIERS: Readonly<Record<RarityTier, number>> = {
  common: 1, uncommon: 2, rare: 5, epic: 12, legendary: 30, mythic: 80, secret: 250,
};
export const FORM_VALUE_MULTIPLIERS: Readonly<Record<CollectorVariant, number>> = {
  normal: 1, shiny: 4, holo: 6, celestial: 10, glitch: 15,
};
export const VALUE_FORM_LABELS: Readonly<Record<CollectorVariant, string>> = {
  normal: 'Standard', shiny: 'Shiny', holo: 'Holo', celestial: 'Celestial', glitch: 'Glitch',
};

/** A concept always gets the same base value across devices, ids, case and whitespace. */
export function baseElementValue(name: string): number {
  let hash = 2166136261;
  for (const character of discoveryIdentity(name)) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619) >>> 0;
  }
  return 10 + hash % 31;
}

export function elementValue(element: InfiniteElement, requested: CollectorVariant | 'best' = 'best') {
  const owned = availableVariants(element);
  const best = owned.reduce((winner, form) =>
    FORM_VALUE_MULTIPLIERS[form] > FORM_VALUE_MULTIPLIERS[winner] ? form : winner, 'normal');
  // Locked forms cannot contribute a quote. Multiple unlocked finishes never multiply together.
  const variant = requested === 'best' ? best : owned.includes(requested) ? requested : 'normal';
  const rarity = rarityInfo(element.rarityTier);
  const baseCoins = baseElementValue(element.name);
  const rarityMultiplier = RARITY_VALUE_MULTIPLIERS[rarity.id];
  const formMultiplier = FORM_VALUE_MULTIPLIERS[variant];
  return { coins: baseCoins * rarityMultiplier * formMultiplier, baseCoins, rarityMultiplier,
    formMultiplier, variant, rarity: rarity.label, currency: VALUE_CURRENCY, version: VALUE_VERSION };
}

export function formatElementValue(coins: number): string {
  return coins.toLocaleString('en-CA');
}
