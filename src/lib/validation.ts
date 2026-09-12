import type { Material, Oddkin } from '../types';
export const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const color = (v: unknown): v is string => typeof v === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
const rarity = (v: unknown) => ['COMMON','UNCOMMON','RARE','EXOTIC','MYTHIC','ANOMALOUS'].includes(String(v));
export function validSprite(v: unknown): boolean {
  return record(v) && ['primaryColor','secondaryColor','accentColor'].every(k => color(v[k])) &&
    Array.isArray(v.palette) && v.palette.length > 0 && v.palette.every(color);
}
export function validMaterial(v: unknown): v is Material {
  return record(v) && ['id','canonicalName','displayName','description','category'].every(k => text(v[k])) &&
    strings(v.semanticTags) && strings(v.possibleProcessAffinities) && record(v.properties) &&
    Object.values(v.properties).every(x => typeof x === 'boolean') &&
    ['solid','liquid','gas','plasma','amorphous','energy'].includes(v.stateOfMatter) &&
    ['frigid','cold','ambient','warm','hot','incandescent'].includes(v.temperatureClass) &&
    rarity(v.rarity) && finite(v.lifePotential) && finite(v.discoveredAt) &&
    record(v.lineage) && strings(v.lineage.parentIds) && finite(v.lineage.depth) && finite(v.lineage.generation) &&
    validSprite(v.spriteDescriptor) && text(v.spriteDescriptor.baseShape) &&
    (v.customSpriteUrl === undefined || typeof v.customSpriteUrl === 'string');
}
export function validOddkin(v: unknown): v is Oddkin {
  return record(v) && ['speciesId','speciesName','titleOrClassification','description','temperament'].every(k => text(v[k])) &&
    ['ancestryTags','affinities','inheritedMaterialTraits','mutations','habitatPreferences','variantFormsDiscovered'].every(k => strings(v[k])) &&
    record(v.morphology) && ['bodyPlan','surface','symmetry','material','locomotion'].every(k => text(v.morphology[k])) &&
    finite(v.morphology.limbs) && strings(v.morphology.appendages) &&
    record(v.physiology) && ['metabolism','diet','environment','energySource'].every(k => text(v.physiology[k])) &&
    record(v.transformationPotential) && typeof v.transformationPotential.possible === 'boolean' &&
    record(v.lineage) && strings(v.lineage.parentMaterialIds) && finite(v.lineage.depth) &&
    Array.isArray(v.lineage.fullAncestryChain) && v.lineage.fullAncestryChain.every((s: unknown) => record(s) && finite(s.step) && strings(s.inputs) && text(s.process) && text(s.result)) &&
    validSprite(v.spriteSpecification) && strings(v.spriteSpecification.featureDetails) &&
    rarity(v.rarity) && finite(v.discoveredAt) && finite(v.encounterCount) && finite(v.chirpToneHz) &&
    (v.customSpriteUrl === undefined || typeof v.customSpriteUrl === 'string');
}
