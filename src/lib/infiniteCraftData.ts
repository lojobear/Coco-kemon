/**
 * Canonical recipe combinations and starter items for Infinite Craft (by Neal Agarwal)
 */

/**
 * Canonical recipe combinations and starter items for Infinite Craft (by Neal Agarwal)
 */

import type { KitchenRecipe } from './kitchen/engine';

export interface InfiniteElement {
  kitchenRecipe?: KitchenRecipe;
  id: string;
  name: string;
  emoji: string;
  customSpriteUrl?: string;
  discoveredAt?: number;
  isNew?: boolean;
  recipe?: { first: string; second: string };
  explanation?: string;
  connection?: string;
  variantOf?: string;
  // Pokémon-style Shiny expansion:
  isShiny?: boolean;
  unlockedShiny?: boolean;
  shinyDiscoveredAt?: number;
  shinyTitle?: string;
  // Physical properties telemetry
  physicalData?: any;
}

export interface InfiniteCraftPairResponse {
  result: string;
  emoji: string;
  isNew: boolean;
  isShiny?: boolean;
  explanation?: string;
  connection?: string;
  bonus?: { result: string; emoji: string; variantOf: string; explanation: string };
}

export const STARTER_ELEMENTS: InfiniteElement[] = [
  { id: 'water', name: 'Water', emoji: '💧' },
  { id: 'fire', name: 'Fire', emoji: '🔥' },
  { id: 'wind', name: 'Wind', emoji: '💨' },
  { id: 'earth', name: 'Earth', emoji: '🌍' },
];

// NFKC + collapsed whitespace so "Sea  Lion" and "Sea Lion" share one recipe/cache entry
// (and one AI call). Plain single-spaced names produce the same keys as before.
const normalizeName = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export function makePairKey(a: string, b: string): string {
  return [normalizeName(a), normalizeName(b)].sort().join(':::');
}

/**
 * High-fidelity canonical Infinite Craft combinations (from Neal.fun's global dataset)
 */
export const CANONICAL_INFINITE_CRAFT_RECIPES: Record<string, { result: string; emoji: string }> = {
  // Elemental Basics
  [makePairKey('Water', 'Fire')]: { result: 'Steam', emoji: '💨' },
  [makePairKey('Water', 'Earth')]: { result: 'Mud', emoji: '💩' },
  [makePairKey('Water', 'Wind')]: { result: 'Wave', emoji: '🌊' },
  [makePairKey('Fire', 'Earth')]: { result: 'Lava', emoji: '🌋' },
  [makePairKey('Fire', 'Wind')]: { result: 'Smoke', emoji: '💨' },
  [makePairKey('Earth', 'Wind')]: { result: 'Dust', emoji: '🌫️' },

  // Doubling
  [makePairKey('Water', 'Water')]: { result: 'Lake', emoji: '🌊' },
  [makePairKey('Fire', 'Fire')]: { result: 'Volcano', emoji: '🌋' },
  [makePairKey('Wind', 'Wind')]: { result: 'Tornado', emoji: '🌪️' },
  [makePairKey('Earth', 'Earth')]: { result: 'Mountain', emoji: '🏔️' },

  // Secondary Geological & Geographic
  [makePairKey('Lake', 'Water')]: { result: 'Ocean', emoji: '🌊' },
  [makePairKey('Ocean', 'Earth')]: { result: 'Island', emoji: '🏝️' },
  [makePairKey('Island', 'Island')]: { result: 'Continent', emoji: '🌍' },
  [makePairKey('Continent', 'Continent')]: { result: 'Planet', emoji: '🪐' },
  [makePairKey('Planet', 'Fire')]: { result: 'Sun', emoji: '☀️' },
  [makePairKey('Sun', 'Planet')]: { result: 'Solar System', emoji: '🌌' },
  [makePairKey('Solar System', 'Solar System')]: { result: 'Galaxy', emoji: '🌌' },
  [makePairKey('Galaxy', 'Galaxy')]: { result: 'Universe', emoji: '🌌' },

  // Geological Transformations
  [makePairKey('Lava', 'Water')]: { result: 'Stone', emoji: '🪨' },
  [makePairKey('Stone', 'Fire')]: { result: 'Metal', emoji: '🪙' },
  [makePairKey('Stone', 'Water')]: { result: 'Sand', emoji: '🏖️' },
  [makePairKey('Stone', 'Wind')]: { result: 'Sand', emoji: '🏖️' },
  [makePairKey('Sand', 'Fire')]: { result: 'Glass', emoji: '🥃' },
  [makePairKey('Glass', 'Fire')]: { result: 'Lens', emoji: '🔍' },
  [makePairKey('Sand', 'Wind')]: { result: 'Dune', emoji: '🏜️' },
  [makePairKey('Dust', 'Wind')]: { result: 'Sandstorm', emoji: '🌪️' },
  [makePairKey('Lava', 'Earth')]: { result: 'Volcano', emoji: '🌋' },
  [makePairKey('Lava', 'Stone')]: { result: 'Obsidian', emoji: '🪨' },

  // Construction & Materials
  [makePairKey('Mud', 'Fire')]: { result: 'Brick', emoji: '🧱' },
  [makePairKey('Brick', 'Brick')]: { result: 'Wall', emoji: '🧱' },
  [makePairKey('Wall', 'Brick')]: { result: 'House', emoji: '🏠' },
  [makePairKey('House', 'House')]: { result: 'Village', emoji: '🏘️' },
  [makePairKey('Village', 'Village')]: { result: 'Town', emoji: '🏘️' },
  [makePairKey('Town', 'Town')]: { result: 'City', emoji: '🏙️' },
  [makePairKey('City', 'City')]: { result: 'Metropolis', emoji: '🏙️' },

  // Botanical & Life
  [makePairKey('Earth', 'Water')]: { result: 'Plant', emoji: '🌱' },
  [makePairKey('Plant', 'Water')]: { result: 'Swamp', emoji: '🐊' },
  [makePairKey('Plant', 'Plant')]: { result: 'Tree', emoji: '🌲' },
  [makePairKey('Tree', 'Tree')]: { result: 'Forest', emoji: '🌲' },
  [makePairKey('Forest', 'Tree')]: { result: 'Jungle', emoji: '🌴' },
  [makePairKey('Tree', 'Fire')]: { result: 'Ash', emoji: '🌋' },
  [makePairKey('Tree', 'Water')]: { result: 'River', emoji: '🏞️' },
  [makePairKey('Plant', 'Sun')]: { result: 'Flower', emoji: '🌸' },
  [makePairKey('Flower', 'Fire')]: { result: 'Perfume', emoji: '💐' },
  [makePairKey('Plant', 'Wind')]: { result: 'Dandelion', emoji: '🌼' },
  [makePairKey('Dandelion', 'Wind')]: { result: 'Seed', emoji: '🌱' },
  [makePairKey('Plant', 'Glass')]: { result: 'Greenhouse', emoji: '🏡' },

  // Atmospheric & Meteorological
  [makePairKey('Wave', 'Wind')]: { result: 'Storm', emoji: '⛈️' },
  [makePairKey('Wave', 'Wave')]: { result: 'Tsunami', emoji: '🌊' },
  [makePairKey('Steam', 'Wind')]: { result: 'Cloud', emoji: '☁️' },
  [makePairKey('Cloud', 'Water')]: { result: 'Rain', emoji: '🌧️' },
  [makePairKey('Rain', 'Fire')]: { result: 'Rainbow', emoji: '🌈' },
  [makePairKey('Rainbow', 'Gold')]: { result: 'Pot of Gold', emoji: '🪙' },
  [makePairKey('Cloud', 'Sun')]: { result: 'Sky', emoji: '🌤️' },
  [makePairKey('Rain', 'Wind')]: { result: 'Storm', emoji: '⛈️' },
  [makePairKey('Storm', 'Fire')]: { result: 'Lightning', emoji: '⚡' },
  [makePairKey('Lightning', 'Sand')]: { result: 'Fulgurite', emoji: '🪨' },
  [makePairKey('Cloud', 'Cloud')]: { result: 'Thunderstorm', emoji: '⛈️' },
  [makePairKey('Cold', 'Water')]: { result: 'Ice', emoji: '🧊' },
  [makePairKey('Ice', 'Wind')]: { result: 'Blizzard', emoji: '🌨️' },
  [makePairKey('Ice', 'Water')]: { result: 'Iceberg', emoji: '🧊' },

  // Animals & Human
  [makePairKey('Life', 'Earth')]: { result: 'Human', emoji: '🧑' },
  [makePairKey('Life', 'Ocean')]: { result: 'Fish', emoji: '🐟' },
  [makePairKey('Life', 'Dust')]: { result: 'Bug', emoji: '🐛' },
  [makePairKey('Life', 'Swamp')]: { result: 'Bacteria', emoji: '🦠' },
  [makePairKey('Life', 'Sky')]: { result: 'Bird', emoji: '🦅' },
  [makePairKey('Swamp', 'Fire')]: { result: 'Dragon', emoji: '🐉' },
  [makePairKey('Stone', 'Human')]: { result: 'Statue', emoji: '🗿' },
  [makePairKey('Metal', 'Human')]: { result: 'Tool', emoji: '🔨' },
  [makePairKey('Tool', 'Human')]: { result: 'Engineer', emoji: '👷' },
  [makePairKey('Metal', 'Fire')]: { result: 'Sword', emoji: '⚔️' },
  [makePairKey('Sword', 'Human')]: { result: 'Warrior', emoji: '🗡️' },
  [makePairKey('Human', 'Tree')]: { result: 'Woodsman', emoji: '🪓' },
  [makePairKey('Human', 'Fish')]: { result: 'Mermaid', emoji: '🧜‍♀️' },

  // Technology & Civilization
  [makePairKey('Steam', 'Metal')]: { result: 'Engine', emoji: '🚂' },
  [makePairKey('Engine', 'Steam')]: { result: 'Train', emoji: '🚂' },
  [makePairKey('Engine', 'Metal')]: { result: 'Car', emoji: '🚗' },
  [makePairKey('Engine', 'Wind')]: { result: 'Airplane', emoji: '✈️' },
  [makePairKey('Airplane', 'Wind')]: { result: 'Kite', emoji: '🪁' },
  [makePairKey('Engine', 'Boat')]: { result: 'Steamboat', emoji: '🚢' },
  [makePairKey('Water', 'Wood')]: { result: 'Boat', emoji: '⛵' },
  [makePairKey('Tree', 'Axe')]: { result: 'Wood', emoji: '🪵' },
  [makePairKey('Tool', 'Stone')]: { result: 'Axe', emoji: '🪓' },
  [makePairKey('Sand', 'Glass')]: { result: 'Hourglass', emoji: '⏳' },
  [makePairKey('Hourglass', 'Fire')]: { result: 'Time', emoji: '⌛' },
  [makePairKey('Time', 'Human')]: { result: 'Old', emoji: '👴' },
  [makePairKey('Time', 'Tree')]: { result: 'Fossil', emoji: '🦴' },
  [makePairKey('Fossil', 'Time')]: { result: 'Dinosaur', emoji: '🦖' },
  [makePairKey('Dinosaur', 'Fire')]: { result: 'Oil', emoji: '🛢️' },
  [makePairKey('Oil', 'Fire')]: { result: 'Energy', emoji: '⚡' },
  [makePairKey('Energy', 'Metal')]: { result: 'Battery', emoji: '🔋' },
  [makePairKey('Battery', 'Engineer')]: { result: 'Robot', emoji: '🤖' },
  [makePairKey('Robot', 'Human')]: { result: 'Cyborg', emoji: '🦾' },
  [makePairKey('Robot', 'Universe')]: { result: 'AI', emoji: '🧠' },

  // Culture & Fun
  [makePairKey('Human', 'Dinosaur')]: { result: 'Jurassic Park', emoji: '🦖' },
  [makePairKey('Dinosaur', 'Bird')]: { result: 'Pterodactyl', emoji: '🦅' },
  [makePairKey('Water', 'Tea')]: { result: 'Teapot', emoji: '🫖' },
  [makePairKey('Plant', 'Boiling Water')]: { result: 'Tea', emoji: '🍵' },
  [makePairKey('Water', 'Heat')]: { result: 'Boiling Water', emoji: '♨️' },
  [makePairKey('Steam', 'Earth')]: { result: 'Geyser', emoji: '♨️' },
};

