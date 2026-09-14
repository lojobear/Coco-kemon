import type { Material, Oddkin, Process } from '../src/types.js';
import { record, text, color } from '../src/lib/validation.js';

export interface ConceptResult { result: string; emoji: string; explanation?: string; connection?: string }
export function chooseConcept(parsed: unknown, first: string, second: string): ConceptResult | undefined {
  if (!record(parsed)) return;
  const valid = (c: any) => record(c) && text(c.result) && c.result.length <= 160 && text(c.emoji) && c.emoji.length <= 32;
  if (!Array.isArray(parsed.candidates)) {
    // Older model responses remain compatible; they still must have a valid result.
    return valid(parsed) ? { result: parsed.result.trim(), emoji: parsed.emoji.trim() } : undefined;
  }
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const literal = new Set([normalize(first + second), normalize(second + first)]);
  const candidates = parsed.candidates.slice(0, 3).filter((c: any) => valid(c) &&
    text(c.explanation) && c.explanation.length <= 280 &&
    ['science', 'function', 'appearance', 'mythology', 'wordplay'].includes(c.connection) &&
    Number.isInteger(c.coherence) && c.coherence >= 4 && c.coherence <= 5 &&
    Number.isInteger(c.surprise) && c.surprise >= 1 && c.surprise <= 5 &&
    !literal.has(normalize(c.result)) &&
    ![normalize(first), normalize(second)].includes(normalize(c.result)));
  candidates.sort((a: any, b: any) => (b.coherence * 3 + b.surprise) - (a.coherence * 3 + a.surprise));
  const winner = candidates[0];
  return winner ? { result: winner.result.trim(), emoji: winner.emoji.trim(), explanation: winner.explanation.trim(), connection: winner.connection } : undefined;
}

export function inheritanceFor(a: Material, b: Material | undefined, process: Pick<Process, 'id' | 'name'>) {
  const parents = [a, ...(b ? [b] : [])];
  const traits = parents.map(parent => {
    const p = parent.properties;
    const feature = p.crystalline ? 'faceted translucent plates' : p.metallic ? 'jointed metal armor' :
      p.organic ? 'leaflike frills and branching veins' : p.liquid ? 'a fluid body with rippling edges' :
      p.gaseous ? 'a wispy floating mantle' : p.mineral ? 'pebbled stone plating' : 'a patterned outer mantle';
    return `${parent.displayName}: ${feature}`;
  });
  if (parents.some(p => p.properties.conductive)) traits.push('Conductive ancestry: branching luminous veins');
  if (process.id === 'MOONLIGHT') traits.push('Moonlight exposure: softly glowing crescent markings');
  if (process.id === 'FOSSILIZE') traits.push('Fossilization: layered mineral ridges');
  if (process.id === 'ENCHANT') traits.push('Enchantment: luminous rings around inherited features');
  const locomotion = parents.some(p => p.properties.gaseous) ? 'float' : parents.some(p => p.properties.liquid) ? 'slither' :
    parents.some(p => p.properties.organic) ? 'hop' : 'crawl';
  return { traits, locomotion,
    primaryColor: a.spriteDescriptor.primaryColor,
    secondaryColor: (b || a).spriteDescriptor.secondaryColor,
    accentColor: process.id === 'MOONLIGHT' ? '#c4b5fd' : (b || a).spriteDescriptor.accentColor,
  };
}
export function applyInheritance(oddkin: Oddkin, a: Material, b: Material | undefined, process: Process): Oddkin {
  const inherited = inheritanceFor(a, b, process);
  return { ...oddkin,
    inheritedMaterialTraits: [...new Set([...inherited.traits, ...oddkin.inheritedMaterialTraits])].slice(0, 8),
    morphology: { ...oddkin.morphology, locomotion: inherited.locomotion as Oddkin['morphology']['locomotion'] },
    spriteSpecification: { ...oddkin.spriteSpecification,
      primaryColor: inherited.primaryColor, secondaryColor: inherited.secondaryColor, accentColor: inherited.accentColor,
      palette: [inherited.primaryColor, inherited.secondaryColor, inherited.accentColor, color(oddkin.spriteSpecification.outlineColor) ? oddkin.spriteSpecification.outlineColor : '#111827'],
      featureDetails: [...new Set([...inherited.traits, ...oddkin.spriteSpecification.featureDetails])].slice(0, 8),
    },
  };
}
