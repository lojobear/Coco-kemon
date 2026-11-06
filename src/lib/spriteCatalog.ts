import type { InfiniteElement } from './infiniteCraftData';
import type { Material, Oddkin } from '../types';
import { discoveryIdentity } from './unifiedCollection';

export type SpriteSourceType = 'craft' | 'material' | 'oddkin';
export interface SpriteCatalogEntry {
  key: string;
  name: string;
  craft?: InfiniteElement;
  material?: Material;
  oddkin?: Oddkin;
  sources: SpriteSourceType[];
  sprite?: string;
  discoveredAt: number;
}

function time(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Gallery-only projection: one concept row across Craft and Foundry. The
 * original records and all recipe/mastery/lineage metadata remain unchanged.
 * Oddkin stay separate because they are distinct creature inventory records.
 * A legacy procedural Foundry thumbnail is not finished uploaded artwork.
 */
export function buildSpriteCatalog(
  craft: readonly InfiniteElement[],
  materials: readonly Material[],
  oddkin: readonly Oddkin[],
  isProceduralMaterial: (material: Material) => boolean = () => false,
): SpriteCatalogEntry[] {
  const concepts = new Map<string, SpriteCatalogEntry>();
  for (const item of craft) {
    const name = item.name?.trim();
    if (!name) continue;
    const key = discoveryIdentity(name);
    const existing = concepts.get(key);
    if (!existing) {
      concepts.set(key, {
        key: `concept:${key}`, name,
        craft: item, sources: ['craft'],
        discoveredAt: Math.max(time(item.discoveredAt), time(item.lastCraftedAt)),
      });
    } else {
      if (!existing.craft || (!existing.craft.customSpriteUrl && item.customSpriteUrl)) existing.craft = item;
      existing.discoveredAt = Math.max(existing.discoveredAt, time(item.discoveredAt), time(item.lastCraftedAt));
    }
  }
  for (const item of materials) {
    const name = item.displayName?.trim();
    if (!name) continue;
    const identity = discoveryIdentity(name);
    let group = concepts.get(identity);
    if (!group) {
      group = { key: `concept:${identity}`, name, sources: [], discoveredAt: 0 };
      concepts.set(identity, group);
    }
    if (!group.material || (!group.material.customSpriteUrl && item.customSpriteUrl)) group.material = item;
    if (!group.sources.includes('material')) group.sources.push('material');
    group.discoveredAt = Math.max(group.discoveredAt, time(item.discoveredAt));
  }
  const rows = [...concepts.values()];
  for (const group of rows) {
    const material = group.material;
    const procedural = material?.customSpriteUrl ? isProceduralMaterial(material) : false;
    const craftArt = group.craft?.customSpriteUrl;
    const craftIsOldPlaceholder = Boolean(procedural && craftArt && craftArt === material?.customSpriteUrl);
    // User-owned Craft art takes priority, otherwise reuse genuine Material
    // artwork. Do not turn a generated fallback into a "saved" sprite.
    group.sprite = (!craftIsOldPlaceholder && craftArt)
      || (material && !procedural ? material.customSpriteUrl : undefined)
      || undefined;
  }
  for (const item of oddkin) {
    if (!item.speciesName?.trim()) continue;
    rows.push({
      key: `oddkin:${item.speciesId}`, name: item.speciesName,
      oddkin: item, sources: ['oddkin'], sprite: item.customSpriteUrl,
      discoveredAt: time(item.discoveredAt),
    });
  }
  rows.sort((a,b)=>b.discoveredAt-a.discoveredAt || a.name.localeCompare(b.name));
  return rows;
}

/** Applies one explicit Sprite Lab artwork change to all linked concept
 * records while leaving other discoveries and every kind of progress intact.
 * Caller saves the resulting payload using existing save validation. */
export function withUnifiedDiscoveryArtwork<T extends {
  crafting?: InfiniteElement[];
  foundry?: { materials?: Material[] } | null;
}>(payload: T, name: string, sprite: string | undefined, rendererVersion: number): T {
  const identity = discoveryIdentity(name);
  return {
    ...payload,
    crafting: payload.crafting?.map(item => discoveryIdentity(item.name) === identity
      ? { ...item, customSpriteUrl: sprite } : item),
    foundry: payload.foundry ? {
      ...payload.foundry,
      materials: payload.foundry.materials?.map(item => discoveryIdentity(item.displayName) === identity
        ? { ...item, customSpriteUrl: sprite, spriteRendererVersion: rendererVersion } : item),
    } : payload.foundry,
  };
}
