import type { InfiniteElement } from './infiniteCraftData';
import type { CollectorVariant } from './collectorData';
import { normalizeElementStats } from './elementStats';
export type CopyCounts = Record<CollectorVariant, number>;
export const COPY_FORMS = ['normal','shiny','holo','celestial','glitch'] as const;
export const emptyCopyCounts = (): CopyCounts => ({normal:0,shiny:0,holo:0,celestial:0,glitch:0});
export function validCopyCounts(value: unknown): value is Partial<CopyCounts> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([key,count]) => COPY_FORMS.includes(key as CollectorVariant) && Number.isSafeInteger(count) && count >= 0);
}
/** One sellable copy per recorded craft. Old saves conservatively allocate known special hits first. */
export function earnedCopyCounts(element: InfiniteElement): CopyCounts {
  const normalized = normalizeElementStats(element);
  let remaining = normalized.craftCount || 0;
  const counts = emptyCopyCounts();
  if (!Number.isSafeInteger(remaining)) return counts;
  const recorded = element.copyCounts;
  const legacy = { normal: remaining, shiny: normalized.shinyCraftCount || 0,
    holo: element.unlockedHolo ? 1 : 0, celestial: element.unlockedCelestial ? 1 : 0, glitch: element.unlockedGlitch ? 1 : 0 };
  for (const form of ['glitch','celestial','holo','shiny','normal'] as const) {
    const count = recorded ? recorded[form] || 0 : legacy[form];
    counts[form] = Math.min(remaining, Number.isSafeInteger(count) && count > 0 ? count : 0);
    remaining -= counts[form];
  }
  counts.normal += remaining; // Untracked legacy/Kitchen crafts remain standard copies.
  return counts;
}
export function addCraftCopy(element: InfiniteElement | undefined, form: CollectorVariant): CopyCounts {
  const counts = element ? earnedCopyCounts(element) : emptyCopyCounts();
  counts[form] += 1;
  return counts;
}
