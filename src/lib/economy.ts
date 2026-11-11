import type { InfiniteElement } from './infiniteCraftData';
import type { CollectorVariant } from './collectorData';
import { availableVariants } from './collectorData';
import { earnedCopyCounts, validCopyCounts, type CopyCounts } from './elementCopies';
import { elementValue, buildCollectionValueBook } from './elementValue';
import { discoveryIdentity } from './unifiedCollection';
export interface Economy { version: 1; coins: number; sold: Record<string, Partial<CopyCounts>>; }
export const emptyEconomy = (): Economy => ({version:1,coins:0,sold:{}});
export function validEconomy(value: unknown): value is Economy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Economy;
  return v.version === 1 && Number.isSafeInteger(v.coins) && v.coins >= 0 && !!v.sold &&
    typeof v.sold === 'object' && !Array.isArray(v.sold) &&
    Object.entries(v.sold).every(([key,counts]) => key.length > 0 && key.length <= 160 && discoveryIdentity(key) === key && validCopyCounts(counts));
}
export function availableCopies(element: InfiniteElement, economy: Economy, form: CollectorVariant): number {
  if (!availableVariants(element).includes(form)) return 0;
  const name = discoveryIdentity(element.name);
  const sold = Object.hasOwn(economy.sold, name) ? economy.sold[name]?.[form] || 0 : 0;
  return Math.max(0, earnedCopyCounts(element)[form] - sold);
}
/** Pure sale; the caller must commit wallet and receipts atomically before reporting success. */
export function applySale(element: InfiniteElement, economy: Economy, form: CollectorVariant, quantity = 1, collection?: readonly InfiniteElement[]) {
  if (!validEconomy(economy) || !Number.isSafeInteger(quantity) || quantity < 1 ||
    quantity > availableCopies(element, economy, form)) throw new Error('Not enough earned copies to sell.');
  const price = elementValue(element, form, collection ? buildCollectionValueBook(collection) : undefined).coins;
  const proceeds = price * quantity;
  if (!Number.isSafeInteger(proceeds) || !Number.isSafeInteger(economy.coins + proceeds)) throw new Error('Wallet limit reached.');
  const name = discoveryIdentity(element.name);
  const previous = Object.hasOwn(economy.sold, name) ? economy.sold[name] : {};
  const next: Economy = { version:1, coins:economy.coins + proceeds,
    sold:{...economy.sold,[name]:{...previous,[form]:(previous[form] || 0) + quantity}} };
  return { economy:next, proceeds, quantity, price };
}
