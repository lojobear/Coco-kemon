import type { Material, Oddkin, Process } from '../src/types.js';
import { record, text, color } from '../src/lib/validation.js';

export type ConceptConnection =
  | 'science'
  | 'function'
  | 'appearance'
  | 'mythology'
  | 'wordplay'
  | 'chemistry'
  | 'physics'
  | 'biology'
  | 'ecology'
  | 'technology'
  | 'history'
  | 'geography'
  | 'food'
  | 'pop-culture'
  | 'brand'
  | 'character'
  | 'comedy'
  | 'language';

export interface ConceptDNA {
  parents: [string, string];
  domains: string[];
  properties: string[];
  functions: string[];
  material?: string;
  state: 'solid' | 'liquid' | 'gas' | 'plasma' | 'energy' | 'abstract' | 'unknown';
  living: boolean;
  edible: boolean;
  powered: boolean;
  temperature: 'cold' | 'ambient' | 'hot' | 'variable' | 'unknown';
  scale: 'tiny' | 'small' | 'human' | 'large' | 'massive' | 'abstract' | 'unknown';
  chainPotential: number;
}

export interface ConceptResult {
  result: string;
  emoji: string;
  explanation?: string;
  connection?: string;
  dna?: ConceptDNA;
  engineScore?: number;
  chainPotential?: number;
}

type Candidate = {
  result: string;
  emoji: string;
  explanation: string;
  connection: ConceptConnection;
  coherence?: number;
  surprise?: number;
  inputFit?: number;
  recognizability?: number;
  chainPotential?: number;
  novelty?: number;
};

const CONNECTIONS = new Set<ConceptConnection>([
  'science', 'function', 'appearance', 'mythology', 'wordplay',
  'chemistry', 'physics', 'biology', 'ecology', 'technology',
  'history', 'geography', 'food', 'pop-culture', 'brand',
  'character', 'comedy', 'language',
]);

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'inside', 'that', 'this', 'these', 'those',
  'its', 'their', 'then', 'than', 'over', 'under', 'through', 'using', 'use', 'used', 'becomes',
  'become', 'forms', 'form', 'creates', 'create', 'makes', 'make', 'made', 'both', 'each', 'when',
]);

const GENERIC_TERMS = new Set([
  'thing', 'object', 'stuff', 'mixture', 'fusion', 'hybrid', 'combo', 'entity', 'concept',
  'creation', 'compound', 'material', 'item', 'creature', 'being', 'product',
]);

const OVERUSED_ROOTS = [
  'quantum', 'cosmic', 'matrix', 'core', 'shard', 'crystal', 'neo', 'proto', 'mega', 'ultra',
  'fusion', 'hybrid', 'aether', 'void', 'stellar', 'energy', 'element', 'essence', 'orb',
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  chemistry: ['chemical', 'molecule', 'atom', 'acid', 'base', 'reaction', 'compound', 'element', 'salt', 'gas'],
  physics: ['energy', 'force', 'gravity', 'light', 'wave', 'pressure', 'motion', 'electric', 'magnetic', 'quantum'],
  biology: ['animal', 'plant', 'cell', 'organism', 'species', 'life', 'living', 'gene', 'blood', 'bone'],
  ecology: ['forest', 'ocean', 'river', 'ecosystem', 'habitat', 'climate', 'wildlife', 'reef', 'desert'],
  technology: ['machine', 'computer', 'robot', 'engine', 'device', 'digital', 'network', 'software', 'tool', 'mechanical'],
  mythology: ['myth', 'god', 'goddess', 'dragon', 'unicorn', 'phoenix', 'spirit', 'legend', 'magic'],
  geography: ['mountain', 'island', 'continent', 'country', 'city', 'river', 'ocean', 'valley', 'volcano'],
  history: ['ancient', 'empire', 'king', 'queen', 'medieval', 'historic', 'war', 'dynasty', 'civilization'],
  food: ['food', 'eat', 'edible', 'cook', 'bread', 'fruit', 'meat', 'soup', 'drink', 'dessert'],
  language: ['word', 'name', 'phrase', 'pun', 'language', 'letter', 'sound', 'meaning'],
  culture: ['movie', 'game', 'character', 'brand', 'music', 'comic', 'show', 'celebrity', 'pokemon'],
  time: ['time', 'clock', 'hour', 'day', 'night', 'future', 'past', 'age'],
};

const FUNCTION_WORDS = [
  'measure', 'store', 'protect', 'transport', 'cut', 'light', 'heat', 'cool', 'fly', 'swim',
  'grow', 'eat', 'power', 'communicate', 'build', 'heal', 'attack', 'defend', 'contain', 'signal',
  'explode', 'freeze', 'burn', 'filter', 'clean', 'connect', 'move', 'carry', 'write', 'read', 'see',
];

const PROPERTY_KEYWORDS = [
  'hot', 'cold', 'wet', 'dry', 'metallic', 'wooden', 'glass', 'stone', 'rock', 'liquid', 'solid',
  'gas', 'electric', 'magnetic', 'organic', 'crystal', 'frozen', 'fiery', 'bright', 'dark', 'soft',
  'hard', 'sharp', 'heavy', 'lightweight', 'transparent', 'poisonous', 'sweet', 'salty', 'spicy',
];

const resultUsage = new Map<string, number>();
const conceptRegistry = new Map<string, ConceptDNA>();
const recentResults: string[] = [];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function words(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(Boolean);
}

function meaningfulTokens(s: string): string[] {
  return words(s).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function unique(values: string[], limit: number): string[] {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function hasIngredientReference(explanation: string, ingredient: string): boolean {
  const compactExplanation = normalize(explanation);
  const compactIngredient = normalize(ingredient);
  if (compactIngredient && compactExplanation.includes(compactIngredient)) return true;
  const explanationTokens = new Set(meaningfulTokens(explanation));
  return meaningfulTokens(ingredient).some(token => explanationTokens.has(token));
}

function lexicalOverlap(result: string, ingredient: string): boolean {
  const resultTokens = new Set(meaningfulTokens(result));
  return meaningfulTokens(ingredient).some(token => resultTokens.has(token));
}

function lexicalSimilarity(a: string, b: string): number {
  const aa = new Set(meaningfulTokens(a));
  const bb = new Set(meaningfulTokens(b));
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const token of aa) if (bb.has(token)) overlap += 1;
  return overlap / Math.max(aa.size, bb.size);
}

function repeatedRoots(): Set<string> {
  const lowered = recentResults.slice(-40).map(result => result.toLowerCase());
  return new Set(OVERUSED_ROOTS.filter(root => lowered.filter(name => name.includes(root)).length >= 2));
}

function rememberResult(result: string) {
  recentResults.push(result);
  if (recentResults.length > 80) recentResults.splice(0, recentResults.length - 80);
}

function inferDomains(textBlob: string, connection: string, parentDomains: string[]): string[] {
  const lower = textBlob.toLowerCase();
  const domains = [...parentDomains];
  const routeDomain: Record<string, string> = {
    science: 'science', function: 'technology', appearance: 'visual', mythology: 'mythology',
    wordplay: 'language', chemistry: 'chemistry', physics: 'physics', biology: 'biology', ecology: 'ecology',
    technology: 'technology', history: 'history', geography: 'geography', food: 'food',
    'pop-culture': 'culture', brand: 'culture', character: 'culture', comedy: 'language', language: 'language',
  };
  if (routeDomain[connection]) domains.push(routeDomain[connection]);
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(keyword => lower.includes(keyword))) domains.push(domain);
  }
  return unique(domains, 8);
}

function inferFunctions(textBlob: string, parentFunctions: string[]): string[] {
  const lower = textBlob.toLowerCase();
  const found = FUNCTION_WORDS.filter(word => lower.includes(word));
  return unique([...found, ...parentFunctions], 8);
}

function inferProperties(textBlob: string, parentProperties: string[]): string[] {
  const lower = textBlob.toLowerCase();
  const found = PROPERTY_KEYWORDS.filter(word => lower.includes(word));
  return unique([...found, ...parentProperties], 10);
}

function inferMaterial(textBlob: string): string | undefined {
  const lower = textBlob.toLowerCase();
  for (const material of ['glass', 'metal', 'wood', 'stone', 'rock', 'water', 'ice', 'crystal', 'ceramic', 'plastic', 'cloth', 'paper', 'sand']) {
    if (lower.includes(material)) return material;
  }
  return undefined;
}

function inferState(textBlob: string): ConceptDNA['state'] {
  const lower = textBlob.toLowerCase();
  if (/\b(plasma|ionized)\b/.test(lower)) return 'plasma';
  if (/\b(energy|light|electricity|radiation|heat)\b/.test(lower)) return 'energy';
  if (/\b(gas|vapor|steam|smoke|air|wind|cloud)\b/.test(lower)) return 'gas';
  if (/\b(liquid|water|ocean|river|juice|oil|soup|drink)\b/.test(lower)) return 'liquid';
  if (/\b(idea|time|language|music|emotion|dream|concept|memory)\b/.test(lower)) return 'abstract';
  if (/\b(rock|stone|glass|metal|wood|ice|crystal|machine|tool|animal|plant|food)\b/.test(lower)) return 'solid';
  return 'unknown';
}

function inferTemperature(textBlob: string): ConceptDNA['temperature'] {
  const lower = textBlob.toLowerCase();
  const hot = /\b(hot|fire|flame|burn|lava|sun|boil|heat|molten)\b/.test(lower);
  const cold = /\b(cold|ice|frozen|freeze|snow|frost|glacier)\b/.test(lower);
  if (hot && cold) return 'variable';
  if (hot) return 'hot';
  if (cold) return 'cold';
  return 'unknown';
}

function inferScale(textBlob: string): ConceptDNA['scale'] {
  const lower = textBlob.toLowerCase();
  if (/\b(atom|micro|tiny|mini|seed|grain|pixel)\b/.test(lower)) return 'tiny';
  if (/\b(insect|mouse|cup|phone|small)\b/.test(lower)) return 'small';
  if (/\b(person|human|bike|desk|door|human-sized)\b/.test(lower)) return 'human';
  if (/\b(house|tree|car|whale|large)\b/.test(lower)) return 'large';
  if (/\b(city|mountain|planet|star|galaxy|ocean|massive|giant)\b/.test(lower)) return 'massive';
  if (/\b(idea|time|language|emotion|dream|concept)\b/.test(lower)) return 'abstract';
  return 'unknown';
}

function inferDNA(candidate: Candidate, first: string, second: string): ConceptDNA {
  const firstDNA = conceptRegistry.get(normalize(first));
  const secondDNA = conceptRegistry.get(normalize(second));
  const inheritedDomains = [...(firstDNA?.domains || []), ...(secondDNA?.domains || [])].slice(0, 4);
  const inheritedProperties = [...(firstDNA?.properties || []), ...(secondDNA?.properties || [])].slice(0, 4);
  const inheritedFunctions = [...(firstDNA?.functions || []), ...(secondDNA?.functions || [])].slice(0, 3);
  const blob = `${candidate.result} ${candidate.explanation} ${candidate.connection}`;
  const domains = inferDomains(blob, candidate.connection, inheritedDomains);
  const properties = inferProperties(blob, inheritedProperties);
  const functions = inferFunctions(blob, inheritedFunctions);
  const resultWordCount = words(candidate.result).length;
  const hookCount = domains.length + Math.min(properties.length, 4) + Math.min(functions.length, 3);
  let chainPotential = Math.max(1, Math.min(5, Math.ceil(hookCount / 3)));
  if (resultWordCount >= 1 && resultWordCount <= 3 && hookCount >= 3) chainPotential = Math.min(5, chainPotential + 1);
  if (GENERIC_TERMS.has(candidate.result.toLowerCase())) chainPotential = Math.max(1, chainPotential - 2);

  const lower = blob.toLowerCase();
  return {
    parents: [first, second],
    domains,
    properties,
    functions,
    material: inferMaterial(blob),
    state: inferState(blob),
    living: /\b(living|animal|plant|organism|creature|person|human|bird|fish|insect|tree)\b/.test(lower),
    edible: /\b(edible|food|eat|drink|bread|fruit|meat|soup|dessert|candy|cake)\b/.test(lower),
    powered: /\b(power|powered|electric|battery|engine|motor|energy|fuel)\b/.test(lower),
    temperature: inferTemperature(blob),
    scale: inferScale(blob),
    chainPotential,
  };
}

function validOptionalScore(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5);
}

function candidateIsValid(c: unknown, first: string, second: string): c is Candidate {
  if (!record(c) || !text(c.result) || c.result.length > 160 || !text(c.emoji) || c.emoji.length > 32) return false;
  if (!text(c.explanation) || c.explanation.length > 280 || !text(c.connection) || !CONNECTIONS.has(c.connection as ConceptConnection)) return false;
  if (![c.coherence, c.surprise, c.inputFit, c.recognizability, c.chainPotential, c.novelty].every(validOptionalScore)) return false;
  // Model scores are advisory, but very low fit is enough to reject a candidate early.
  if (typeof c.coherence === 'number' && c.coherence < 3) return false;
  if (typeof c.inputFit === 'number' && c.inputFit < 3) return false;

  const normalizedResult = normalize(c.result);
  const normalizedFirst = normalize(first);
  const normalizedSecond = normalize(second);
  const literal = new Set([
    normalize(first + second), normalize(second + first),
    normalize(`${first} ${second}`), normalize(`${second} ${first}`),
  ]);
  if (!normalizedResult || literal.has(normalizedResult)) return false;
  if (normalizedResult === normalizedFirst || normalizedResult === normalizedSecond) return false;
  return true;
}

function scoreCandidate(candidate: Candidate, first: string, second: string, routeFrequency: Map<string, number>): { score: number; dna: ConceptDNA } {
  const dna = inferDNA(candidate, first, second);
  const mentionsFirst = hasIngredientReference(candidate.explanation, first);
  const mentionsSecond = hasIngredientReference(candidate.explanation, second);
  const overlapsFirst = lexicalOverlap(candidate.result, first);
  const overlapsSecond = lexicalOverlap(candidate.result, second);
  const resultWords = words(candidate.result);
  const normalizedResult = normalize(candidate.result);

  let score = 0;

  // Ingredient contribution is the highest-value signal.
  if (mentionsFirst) score += 18;
  if (mentionsSecond) score += 18;
  if (overlapsFirst) score += 4;
  if (overlapsSecond) score += 4;
  if (!mentionsFirst && !mentionsSecond && !overlapsFirst && !overlapsSecond) score -= 32;
  if ((mentionsFirst || overlapsFirst) !== (mentionsSecond || overlapsSecond)) score -= 8;

  // Model self-scores are hints only; server-derived evidence remains dominant.
  if (candidate.inputFit) score += candidate.inputFit * 2;
  if (candidate.recognizability) score += candidate.recognizability * 1.5;
  if (candidate.chainPotential) score += candidate.chainPotential * 2;
  if (candidate.novelty) score += candidate.novelty;
  if (candidate.coherence) score += candidate.coherence;

  // Reward results that are easy to recognize and useful in later recipes.
  if (resultWords.length >= 1 && resultWords.length <= 3) score += 10;
  else if (resultWords.length === 4) score += 4;
  else if (resultWords.length > 6) score -= 10;
  score += dna.chainPotential * 6;
  score += Math.min(10, dna.domains.length * 2 + dna.functions.length + dna.properties.length);

  // Prefer candidates that explore a distinct relationship route.
  if ((routeFrequency.get(candidate.connection) || 0) === 1) score += 4;

  // Explanation quality matters, but verbosity does not.
  if (candidate.explanation.length >= 35 && candidate.explanation.length <= 220) score += 5;
  if (candidate.explanation.length < 18) score -= 5;

  // Penalize dead-end generic mashups and odd formatting.
  if (resultWords.some(word => GENERIC_TERMS.has(word))) score -= 18;
  if (/[^\p{L}\p{N}\s'’&+.-]/u.test(candidate.result)) score -= 6;
  if (/^(super|mega|ultra|magic|mystic|cosmic|quantum|neo|proto)\s+/i.test(candidate.result)) score -= 8;
  if (/(matrix|core|shard|essence|orb)$/i.test(candidate.result) && !(mentionsFirst && mentionsSecond)) score -= 8;

  // Different recipes should not collapse into the same answer or naming family over and over.
  const usage = resultUsage.get(normalizedResult) || 0;
  score -= Math.min(18, usage * 4);
  const closestRecent = recentResults.reduce((max, result) => Math.max(max, lexicalSimilarity(candidate.result, result)), 0);
  score -= closestRecent * 18;
  const overused = repeatedRoots();
  if ([...overused].some(root => candidate.result.toLowerCase().includes(root))) score -= 16;

  return { score, dna };
}

export function conceptDNAFor(name: string): ConceptDNA | undefined {
  const dna = conceptRegistry.get(normalize(name));
  return dna ? { ...dna, domains: [...dna.domains], properties: [...dna.properties], functions: [...dna.functions], parents: [...dna.parents] as [string, string] } : undefined;
}

export function chooseConcept(parsed: unknown, first: string, second: string): ConceptResult | undefined {
  if (!record(parsed)) return;

  // Older model responses remain compatible.
  if (!Array.isArray(parsed.candidates)) {
    if (!text(parsed.result) || parsed.result.length > 160 || !text(parsed.emoji) || parsed.emoji.length > 32) return;
    const fallback: Candidate = {
      result: parsed.result.trim(),
      emoji: parsed.emoji.trim(),
      explanation: text(parsed.explanation) ? parsed.explanation.trim() : `${first} and ${second} combine into ${parsed.result.trim()}.`,
      connection: text(parsed.connection) && CONNECTIONS.has(parsed.connection as ConceptConnection) ? parsed.connection as ConceptConnection : 'science',
    };
    if (!candidateIsValid(fallback, first, second)) return;
    const { score, dna } = scoreCandidate(fallback, first, second, new Map([[fallback.connection, 1]]));
    if (score < 18) return;
    conceptRegistry.set(normalize(fallback.result), dna);
    resultUsage.set(normalize(fallback.result), (resultUsage.get(normalize(fallback.result)) || 0) + 1);
    rememberResult(fallback.result);
    return {
      result: fallback.result,
      emoji: fallback.emoji,
      explanation: fallback.explanation,
      connection: fallback.connection,
      dna,
      engineScore: Math.round(score),
      chainPotential: dna.chainPotential,
    };
  }

  // Accept a broad candidate set; ranking is fully server-side.
  const candidates = parsed.candidates.slice(0, 10).filter((c: unknown) => candidateIsValid(c, first, second)) as Candidate[];
  if (!candidates.length) return;

  const routeFrequency = new Map<string, number>();
  for (const candidate of candidates) routeFrequency.set(candidate.connection, (routeFrequency.get(candidate.connection) || 0) + 1);

  const ranked = candidates
    .map(candidate => ({ candidate, ...scoreCandidate(candidate, first, second, routeFrequency) }))
    .sort((a, b) => b.score - a.score || b.dna.chainPotential - a.dna.chainPotential || a.candidate.result.localeCompare(b.candidate.result));

  const winner = ranked[0];
  if (!winner || winner.score < 18) return;

  const result = winner.candidate.result.trim();
  const key = normalize(result);
  conceptRegistry.set(key, winner.dna);
  resultUsage.set(key, (resultUsage.get(key) || 0) + 1);
  rememberResult(result);

  return {
    result,
    emoji: winner.candidate.emoji.trim(),
    explanation: winner.candidate.explanation.trim(),
    connection: winner.candidate.connection,
    dna: winner.dna,
    engineScore: Math.round(winner.score),
    chainPotential: winner.dna.chainPotential,
  };
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
