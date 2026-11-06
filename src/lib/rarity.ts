/**
 * Published Boop cosmetic roll rates.
 * Each successful combination independently rolls one tier and the
 * Shiny/Celestial/Holo/Glitch finishes. Rolls never change the AI recipe.
 * A finish is a collectible visual treatment, NOT a new paid sprite request.
 */
export const SHINY_ODDS = 512;
export const CELESTIAL_ODDS = 4096;
export const HOLO_ODDS = 2048;
export const GLITCH_ODDS = 8192;

export const RARITY_TIERS = [
  { id:'common', label:'Common', weight:6000, symbol:'●' },
  { id:'uncommon', label:'Uncommon', weight:2500, symbol:'◆' },
  { id:'rare', label:'Rare', weight:1000, symbol:'✧' },
  { id:'epic', label:'Epic', weight:350, symbol:'✦' },
  { id:'legendary', label:'Legendary', weight:120, symbol:'★' },
  { id:'mythic', label:'Mythic', weight:29, symbol:'✶' },
  { id:'secret', label:'Secret', weight:1, symbol:'✺' },
] as const;
export type RarityTier = typeof RARITY_TIERS[number]['id'];
export const RARITY_DENOMINATOR = 10_000;
export const RARITY_TIER_IDS: ReadonlySet<string> = new Set(RARITY_TIERS.map(t=>t.id));
export function isRarityTier(value: unknown): value is RarityTier {
  return typeof value === 'string' && RARITY_TIER_IDS.has(value);
}

/** Unbiased 32-bit rejection sampler, with a Math.random fallback for browsers
 * missing Web Crypto. Web Crypto is cryptographically secure pseudorandom,
 * not physical "true random", and repeat outcomes remain possible. */
export function uniformRandomIndex(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError('Invalid random pool size');
  }
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi?.getRandomValues) {
    const range = 0x100000000;
    const limit = range - range % maxExclusive;
    const draw = new Uint32Array(1);
    do { cryptoApi.getRandomValues(draw); } while (draw[0] >= limit);
    return draw[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

export function rarityInfo(tier: RarityTier | undefined) {
  return RARITY_TIERS.find(t=>t.id===tier) ?? RARITY_TIERS[0];
}
export function rarityChanceLabel(tier: RarityTier | undefined): string {
  const percent = rarityInfo(tier).weight / 100;
  return `${Number(percent.toFixed(2))}%`;
}
export function rarityRank(tier: RarityTier | undefined): number {
  return RARITY_TIERS.findIndex(t=>t.id===tier);
}
export function bestRarity(current: RarityTier | undefined, found: RarityTier): RarityTier {
  return !current || rarityRank(found) > rarityRank(current) ? found : current;
}
/** One independent 10,000-outcome roll. Integer ranges sum exactly to 10,000. */
export function rollRarityTier(draw: (max: number) => number = uniformRandomIndex): RarityTier {
  const value = draw(RARITY_DENOMINATOR);
  if (!Number.isInteger(value) || value < 0 || value >= RARITY_DENOMINATOR) throw new RangeError('Invalid rarity roll');
  let running = 0;
  for (const tier of RARITY_TIERS) {
    running += tier.weight;
    if (value < running) return tier.id;
  }
  throw new Error('Rarity weights must add to 10000');
}
export function rollHolo(draw: (max:number)=>number = uniformRandomIndex): boolean {
  return draw(HOLO_ODDS) === 0;
}
export function rollGlitch(draw: (max:number)=>number = uniformRandomIndex): boolean {
  return draw(GLITCH_ODDS) === 0;
}
/** These are marginal chances of each independent event, not the probability
 * of a particular recipe or the combined chance of two simultaneous hits. */
export function rollOddsCaption(tier: RarityTier | undefined, shiny = false, celestial = false, holo = false, glitch = false): string {
  const outcome = [`${rarityInfo(tier).label} ${rarityChanceLabel(tier)}`,
    `${shiny ? '✦ Shiny hit' : 'Shiny'} 1/${SHINY_ODDS}`,
    `${celestial ? '✶ Celestial hit' : 'Celestial'} 1/${CELESTIAL_ODDS.toLocaleString('en-CA')}`,
    `${holo ? '◈ Holo hit' : 'Holo'} 1/${HOLO_ODDS.toLocaleString('en-CA')}`,
    `${glitch ? '⟡ Glitch hit' : 'Glitch'} 1/${GLITCH_ODDS.toLocaleString('en-CA')}`];
  return `Roll odds · ${outcome.join(' · ')}`;
}
