import type { Material, SynthesisResult } from '../types';
import { validMaterial, validOddkin } from './validation';

/** Compare a multiset, not membership: A+A must never reuse A+B or unary A. */
export function matchesFoundryRecipe(material: Material, inputA: Material, inputB: Material | null, processId: string): boolean {
  if (material.lineage?.processId !== processId) return false;
  const parents = material.lineage.parentIds;
  const expected = [inputA.id, ...(inputB ? [inputB.id] : [])].sort();
  return parents.length === expected.length && [...parents].sort().every((id, i) => id === expected[i]);
}

export function validSynthesisResult(data: SynthesisResult): boolean {
  if (data.status === 'new_material' || data.status === 'existing_material') return validMaterial(data.material);
  if (data.status === 'life_emergence') return validOddkin(data.oddkin);
  return data.status === 'no_reaction' && typeof (data.observationIfFailed || data.explanation) === 'string' && Boolean((data.observationIfFailed || data.explanation).trim());
}

/** Rediscovering a canonical item must preserve its art and original lineage. */
export function resolveMaterialDiscovery(incoming: Material, materials: Material[], status: SynthesisResult['status']) {
  const normalized = incoming.canonicalName.trim().toLowerCase();
  const existing = materials.find(m => m.id === incoming.id || m.canonicalName.trim().toLowerCase() === normalized);
  return { material: existing || incoming, isNew: !existing && status === 'new_material' };
}
