import { makePairKey } from './infiniteCraftData.js';

export interface TrailStep { first: string; second: string; result: string; emoji: string; hint: string }
export interface DiscoveryTrail { id: string; name: string; emoji: string; description: string; steps: TrailStep[] }
// Every trail starts with the four starter elements. Existing recipes are preserved.
export const DISCOVERY_TRAILS: DiscoveryTrail[] = [
  { id: 'storm', name: 'Storm Chasers', emoji: '⛈️', description: 'Bottle a storm, then follow its voice.', steps: [
    { first: 'Water', second: 'Fire', result: 'Steam', emoji: '💨', hint: 'Warm something wet.' },
    { first: 'Steam', second: 'Wind', result: 'Cloud', emoji: '☁️', hint: 'Let the breeze carry your vapor.' },
    { first: 'Cloud', second: 'Cloud', result: 'Thunderstorm', emoji: '⛈️', hint: 'Give a cloud some company.' },
    { first: 'Thunderstorm', second: 'Earth', result: 'Thunder Egg', emoji: '🥚', hint: 'Let the storm settle into the ground.' },
    { first: 'Thunder Egg', second: 'Wind', result: 'Storm Wren', emoji: '🐦', hint: 'A breath of moving air might hatch it.' },
  ] },
  { id: 'glass', name: 'Glass Menagerie', emoji: '🦋', description: 'Turn a volcanic beginning into delicate life.', steps: [
    { first: 'Fire', second: 'Earth', result: 'Lava', emoji: '🌋', hint: 'Warm the ground.' },
    { first: 'Lava', second: 'Water', result: 'Stone', emoji: '🪨', hint: 'Cool the molten earth.' },
    { first: 'Stone', second: 'Wind', result: 'Sand', emoji: '🏖️', hint: 'Let the wind weather stone.' },
    { first: 'Sand', second: 'Fire', result: 'Glass', emoji: '🥃', hint: 'Melt the grains together.' },
    { first: 'Glass', second: 'Wind', result: 'Glasswing', emoji: '🦋', hint: 'Give something transparent the power of flight.' },
    { first: 'Glasswing', second: 'Water', result: 'Prism Koi', emoji: '🐟', hint: 'Trade the sky for a pond.' },
  ] },
  { id: 'moon', name: 'Moonlit Tides', emoji: '🌙', description: 'Follow the ocean into a midnight fable.', steps: [
    { first: 'Water', second: 'Water', result: 'Lake', emoji: '🌊', hint: 'Gather more water.' },
    { first: 'Lake', second: 'Water', result: 'Ocean', emoji: '🌊', hint: 'Let the lake grow.' },
    { first: 'Ocean', second: 'Fire', result: 'Sea Lantern', emoji: '🏮', hint: 'Bring a light to the deep.' },
    { first: 'Sea Lantern', second: 'Wind', result: 'Moon Jelly', emoji: '🪼', hint: 'Let your lantern drift.' },
    { first: 'Moon Jelly', second: 'Earth', result: 'Lunar Garden', emoji: '🌙', hint: 'Plant a little moonlight.' },
  ] },
];
export const TRAIL_RECIPES = Object.fromEntries(DISCOVERY_TRAILS.flatMap(t => t.steps.map(s => [makePairKey(s.first, s.second), {
  result: s.result, emoji: s.emoji, explanation: s.hint, connection: 'discovery trail',
}])));
export function trailProgress(trail: DiscoveryTrail, names: string[]) {
  const owned = new Set(names.map(n => n.trim().toLowerCase()));
  const completed = trail.steps.filter(s => owned.has(s.result.toLowerCase())).length;
  const next = trail.steps.find(s => !owned.has(s.result.toLowerCase()));
  return { completed, next, ready: !!next && owned.has(next.first.toLowerCase()) && owned.has(next.second.toLowerCase()) };
}
export interface RareVariant { result: string; emoji: string; variantOf: string; explanation: string }
const VARIANTS: Record<string, Omit<RareVariant, 'variantOf'>> = {
  Steam: { result: 'Opal Mist', emoji: '🌫️', explanation: 'A rare rainbow sheen condenses inside the steam.' },
  Glass: { result: 'Aurora Glass', emoji: '🌈', explanation: 'A rare cooling pattern traps ribbons of color.' },
  'Storm Wren': { result: 'Ball Lightning Wren', emoji: '⚡', explanation: 'A rare hatchling carries a tiny storm in its chest.' },
  'Prism Koi': { result: 'Eclipse Koi', emoji: '🌘', explanation: 'A rare dark prism bends light around its scales.' },
  'Lunar Garden': { result: 'Blue Moon Orchard', emoji: '🌳', explanation: 'A rare moonlit bloom ripens into luminous fruit.' },
};
export function rollRareVariant(result: string, random: () => number = Math.random): RareVariant | undefined {
  const entry = VARIANTS[result];
  // A bonus collectible, never a replacement for the ordinary result. One in 20 eligible crafts.
  return entry && random() < 0.05 ? { ...entry, variantOf: result } : undefined;
}
