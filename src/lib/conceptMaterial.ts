import type { Material } from '../types.js';
import { STARTER_MATERIALS } from './starterData.js';
import { spriteDescriptorForConcept } from './pixelRenderer.js';

/** Keep the legacy save shape while allowing any named discovery as an input. */
export function conceptMaterial(concept: { result: string; emoji: string; explanation?: string; connection?: string }, parents: Material[] = [], processId = 'MIX'): Material {
  const template = STARTER_MATERIALS[0];
  return {
    ...template,
    id: `concept_${encodeURIComponent(concept.result.trim().toLowerCase())}`,
    canonicalName: concept.result.trim().toUpperCase(), displayName: concept.result.trim(),
    description: concept.explanation || `A discovered concept: ${concept.result}.`,
    category: concept.connection === 'brand' ? 'Brands' : concept.connection === 'character' ? 'Characters' : concept.connection === 'biology' ? 'Animals' : concept.connection === 'food' ? 'Food' : concept.connection === 'pop-culture' ? 'Pop Culture' : 'Discoveries',
    subcategory: concept.connection || 'Concept', stateOfMatter: 'amorphous', temperatureClass: 'ambient',
    properties: Object.fromEntries(Object.keys(template.properties).map(key => [key, false])) as unknown as Material['properties'],
    semanticTags: [concept.result, concept.connection || 'concept', concept.emoji],
    lifePotential: 0, rarity: 'COMMON', discoveredAt: Date.now(),
    possibleProcessAffinities: ['MIX', 'HEAT', 'GROW', 'ENCHANT'],
    lineage: { parentIds: parents.map(p => p.id), processId, depth: Math.max(0, ...parents.map(p => p.lineage.depth)) + 1, generation: Math.max(0, ...parents.map(p => p.lineage.generation)) + 1, recipeDesc: parents.map(p => p.displayName).join(' + ') },
    spriteDescriptor: spriteDescriptorForConcept(concept.result, concept.connection),
    discoveryExplanation: concept.explanation || `Discover ${concept.result} through conceptual crafting.`,
    customSpriteUrl: undefined,
  };
}
