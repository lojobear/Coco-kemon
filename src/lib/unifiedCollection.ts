import type { InfiniteElement } from './infiniteCraftData';
import type { Material, Oddkin } from '../types';
import { isSpriteReference } from './spriteReference';
import { LEGACY_STARTER_DATE } from './starterIdentity';
import { categoryForDiscovery } from './collectionCategories';

/** Shared collection identity: one concept name, regardless of where it was discovered. */
export function discoveryIdentity(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
function storedArtwork(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 100000) return undefined;
  if (isSpriteReference(value) || /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
  return undefined;
}
function iconFor(category: string): string {
  if (/food|edible|culinary/i.test(category)) return '🍽️';
  if (/plant|organic|flora|botanic/i.test(category)) return '🌿';
  if (/metal|mechanic|technology/i.test(category)) return '⚙️';
  if (/energy|electr|plasma/i.test(category)) return '⚡';
  if (/mineral|stone|geo/i.test(category)) return '🪨';
  return '✨';
}
export type FoundryCollection = { materials?: readonly Material[]; oddkinCollection?: readonly Oddkin[] } | null | undefined;
/**
 * Non-destructive migration / projection:
 * - Craft entries win on collisions (preserves their original artwork, rare variants,
 *   recipe history, mastery and creation timestamps).
 * - Foundry keeps its full Material/Oddkin metadata in its own archive.
 * - Only previously absent concept names are copied into the shared Craft inventory.
 * - The caller can detect an unchanged collection by reference identity.
 */
export function mergeFoundryIntoCraft(
  craft: readonly InfiniteElement[], foundry: FoundryCollection
): InfiniteElement[] {
  const seen = new Set(craft.map(item => discoveryIdentity(item.name)));
  const seenIds = new Set(craft.map(item=>item.id.toLowerCase()));
  const additions: InfiniteElement[] = [];
  const insert = (name: string, emoji: string, details: Partial<InfiniteElement>) => {
    const clean = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const key = discoveryIdentity(clean);
    if (!clean || clean.length > 160 || seen.has(key)) return;
    seen.add(key);
    let id = 'foundry_' + encodeURIComponent(key);
    while(seenIds.has(id.toLowerCase())) id += '_x';
    seenIds.add(id.toLowerCase());
    // JSON saves omit undefined fields. Avoid creating non-round-trippable
    // phantom properties in the migration projection.
    const defined = Object.fromEntries(Object.entries(details).filter(([,value]) => value !== undefined));
    additions.push({ id, name: clean, emoji, ...defined });
  };
  for(const mat of foundry?.materials || []) {
    if (!mat?.displayName) continue;
    const isStarter = mat.discoveredAt === LEGACY_STARTER_DATE && mat.lineage?.depth === 0;
    insert(mat.displayName, iconFor(mat.category), {
      ...(isStarter ? { isStarter: true, craftCount: 0 } : {}),
      category: mat.category || categoryForDiscovery({ name: mat.displayName }),
      explanation: (mat.discoveryExplanation || mat.description || '').slice(0, 280),
      connection: (mat.category || 'Foundry').slice(0, 280),
      discoveredAt: isStarter ? 0 : typeof mat.discoveredAt === 'number' && Number.isFinite(mat.discoveredAt)
        ? mat.discoveredAt : 0,
      customSpriteUrl: storedArtwork(mat.customSpriteUrl),
    });
  }
  for(const oddkin of foundry?.oddkinCollection || []) {
    if (!oddkin?.speciesName) continue;
    insert(oddkin.speciesName, '🐾', {
      category: 'Oddkin & Creatures',
      explanation: (oddkin.description || 'Discovered in Foundry').slice(0, 280),
      connection: 'Oddkin',
      customSpriteUrl: storedArtwork(oddkin.customSpriteUrl),
    });
  }
  return additions.length ? [...craft, ...additions] : craft as InfiniteElement[];
}
