/**
 * ODDKIN FOUNDRY - Server Engine
 * Express + Vite with Gemini AI Structured Synthesis Pipeline
 */

// Clean up Node 22 container global __dirname artifact to prevent ESM createRequire('.') failures
if ((globalThis as unknown as { __dirname?: string }).__dirname === '.') {
  delete (globalThis as unknown as { __dirname?: string }).__dirname;
}

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { callGeminiStructured, ApiFailure, publicFailure } from './server/gemini.js';
import { validMaterial, validOddkin, validSprite, record, text, strings, color, finite } from './src/lib/validation.js';
import { CANONICAL_INFINITE_CRAFT_RECIPES, makePairKey } from './src/lib/infiniteCraftData.js';

dotenv.config();

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    primaryModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite',
    engine: 'infinite-craft-compatible',
    mode: 'logical-real-brand-character-synthesis',
    time: new Date().toISOString(),
  });
});

// --- NEAL AGARWAL'S INFINITE CRAFT ENGINE & PAIR API ---
const dynamicInfiniteCraftCache = new Map<string, { result: string; emoji: string }>();
const discoveredResultsSet = new Set<string>([
  'water', 'fire', 'wind', 'earth',
  ...Object.values(CANONICAL_INFINITE_CRAFT_RECIPES).map(r => r.result.toLowerCase())
]);

async function resolveInfiniteCraftPair(
  rawFirst: string,
  rawSecond: string
): Promise<{ result: string; emoji: string; isNew: boolean }> {
  if (typeof rawFirst !== 'string' || typeof rawSecond !== 'string' || rawFirst.length > 160 || rawSecond.length > 160) throw new ApiFailure(400, 'Provide two names, each under 160 characters.');
  const first = (rawFirst || '').trim();
  const second = (rawSecond || '').trim();
  if (!first || !second) {
    throw new ApiFailure(400, 'Choose two elements first.');
  }

  const key = makePairKey(first, second);

  // 1. Instant match in runtime dynamic cache (already generated or discovered)
  if (dynamicInfiniteCraftCache.has(key)) {
    const cached = dynamicInfiniteCraftCache.get(key)!;
    return { result: cached.result, emoji: cached.emoji, isNew: false };
  }

  // Built-in recipes remain available without an AI call.
  if (CANONICAL_INFINITE_CRAFT_RECIPES[key]) {
    const match = CANONICAL_INFINITE_CRAFT_RECIPES[key];
    dynamicInfiniteCraftCache.set(key, match);
    return { result: match.result, emoji: match.emoji, isNew: false };
  }

  // 3. AI Generation with Gemini API key:
  // Combines two objects into a logical new object (real things, brands, characters, inventions, concepts)
  const systemInstruction = `You are the master synthesis engine for an infinite conceptual crafting game.
Your task is to combine two input concepts, objects, entities, characters, or elements into a SINGLE, LOGICAL, and COHESIVE new object, brand, character, or concept based on their intersection.

CRITICAL LOGIC & REASONING GUIDELINES:
1. THE RESULT MUST BE A LOGICAL, RECOGNIZABLE, COHESIVE ENTITY:
   - REAL-WORLD OBJECTS, FOOD, & INVENTIONS:
     * Bread + Meat -> Sandwich / Burger
     * Glass + Sand -> Hourglass
     * Metal + Electricity -> Computer / Battery
     * Coffee + Ice -> Iced Coffee
     * Fruit + Milk -> Smoothie / Milkshake
     * Wheat + Water -> Beer / Dough
     * Seed + Earth -> Plant / Tree
     * Wood + Strings -> Guitar / Violin
     * Paper + Ink -> Book / Newspaper
     * Metal + Fire -> Sword
     * Sand + Fire -> Glass
     * Milk + Cold -> Ice Cream
     * Fire + Meat -> Barbecue
     * Grape + Time -> Wine
   - REAL BRANDS, TECH & CORPORATIONS:
     * Apple + Phone -> iPhone
     * Electric + Car -> Tesla
     * Computer + Window -> Microsoft
     * Search + Internet -> Google
     * Coffee + Siren / Mermaid -> Starbucks
     * Fast Food + Clown -> McDonald's
     * Toy + Brick -> Lego
     * Shoe + Swoosh / Air -> Nike
     * Space + Rocket -> SpaceX
     * Video + Internet -> YouTube
     * Soda + Red -> Coca-Cola
     * Book + Store -> Amazon
     * Game + Console -> Nintendo / PlayStation
   - CHARACTERS, POP CULTURE, & MYTHOLOGY:
     * Spider + Hero / Radioactivity -> Spider-Man
     * Bat + Hero / Night -> Batman
     * Wizard + Lightning / School -> Harry Potter
     * Monster + Ball -> Pokémon
     * Plumber + Mushroom -> Mario
     * Hedgehog + Speed -> Sonic
     * Ring + Volcano / Dark -> Sauron / Frodo
     * Lightsaber + Dark -> Darth Vader
     * Dragon + Computer -> Cyber Dragon / AI / Digimon
     * Thunder + Hammer / God -> Thor
     * Sea + Trident / God -> Poseidon
     * Sun + Vampire -> Dracula / Dust
     * Dinosaur + Park -> Jurassic Park
     * Ghost + Vacuum -> Luigi's Mansion / Ghostbusters
     * Pirate + Treasure -> One Piece / Captain Hook
   - SCIENCE, NATURE & PHENOMENA:
     * Water + Fire -> Steam
     * Earth + Wind -> Dust
     * Wave + Wind -> Storm
     * Sun + Rain -> Rainbow
     * Horse + Horn -> Unicorn
     * Bird + Fire -> Phoenix
     * Lion + Ocean -> Sea Lion

2. STRICT RULES:
   - NEVER simply concatenate the two inputs into a literal string like "Dragon Computer" or "Apple Phone". Instead, deduce the actual logical resulting object or entity (e.g., "Cyber Dragon" or "iPhone").
   - If two inputs are identical, evolve or scale it up (e.g., Earth + Earth -> Mountain, City + City -> Metropolis, Computer + Computer -> Supercomputer / Internet, Tree + Tree -> Forest, Human + Human -> Family).
   - Keep result to 1 to 3 words, Title Case (e.g., "Spider-Man", "iPhone", "Starbucks", "Black Hole").
   - Select the single most fitting and expressive unicode emoji for the result.
   - Return strictly valid JSON:
{
  "result": "ResultName",
  "emoji": "emoji"
}`;

  const prompt = `Combine the following two concepts into a new logical object, brand, character, or entity:
Object 1: "${first}"
Object 2: "${second}"

Think carefully: What real object, famous brand, pop-culture character, invention, or concept does this logically produce?
Return strictly JSON:
{
  "result": "ResultName",
  "emoji": "emoji"
}`;

  try {
    const rawJson = await callGeminiStructured(prompt, systemInstruction, 0.4);

    if (rawJson) {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed.result === 'string' && parsed.result.trim() && parsed.result.length <= 160 && typeof parsed.emoji === 'string' && parsed.emoji.trim() && parsed.emoji.length <= 32) {
        const cleanedResult = parsed.result.trim();
        const cleanedEmoji = (parsed.emoji || '✨').trim();
        const lowerRes = cleanedResult.toLowerCase();
        const isFirstDiscovery = !discoveredResultsSet.has(lowerRes);

        discoveredResultsSet.add(lowerRes);
        dynamicInfiniteCraftCache.set(key, { result: cleanedResult, emoji: cleanedEmoji });

        return {
          result: cleanedResult,
          emoji: cleanedEmoji,
          isNew: isFirstDiscovery,
        };
      }
    }
  } catch (err) {
    throw err;
  }
  throw new ApiFailure(502, 'AI returned an invalid combination. Please retry.');
}

// Neal.fun's exact endpoint: /api/infinite-craft/pair?first=Water&second=Fire
app.get('/api/infinite-craft/pair', async (req, res) => {
  try {
    const first = String(req.query.first || '');
    const second = String(req.query.second || '');
    if (!first || !second) {
      return res.status(400).json({ error: 'Missing first or second query parameters' });
    }
    const outcome = await resolveInfiniteCraftPair(first, second);
    return res.json(outcome);
  } catch (err: any) {
    const failure = publicFailure(err);
    res.status(failure.status).json({ error: failure.error });
  }
});

// POST variant for Neal.fun API
app.post('/api/infinite-craft/pair', async (req, res) => {
  try {
    const { first, second } = req.body || {};
    if (!first || !second) {
      return res.status(400).json({ error: 'Missing first or second in body' });
    }
    const outcome = await resolveInfiniteCraftPair(first, second);
    return res.json(outcome);
  } catch (err: any) {
    const failure = publicFailure(err);
    res.status(failure.status).json({ error: failure.error });
  }
});

// General pair alias
app.post('/api/pair', async (req, res) => {
  try {
    const { first, second } = req.body || {};
    const outcome = await resolveInfiniteCraftPair(first || '', second || '');
    return res.json(outcome);
  } catch (err: any) {
    const failure = publicFailure(err);
    res.status(failure.status).json({ error: failure.error });
  }
});

// Stats / Discoveries
app.get('/api/infinite-craft/stats', (req, res) => {
  res.json({
    totalDiscoveredCount: discoveredResultsSet.size,
    cachedRecipesCount: dynamicInfiniteCraftCache.size + Object.keys(CANONICAL_INFINITE_CRAFT_RECIPES).length,
  });
});

// Deterministic canonical recipes lookup table for foundational combinations
// to guarantee instant, scientifically crisp results and duplicate avoidance
interface CanonicalRecipe {
  inputs: string[];
  process: string;
  resultName: string;
  category: string;
  stateOfMatter: 'solid' | 'liquid' | 'gas' | 'plasma' | 'amorphous' | 'energy';
  properties: Record<string, boolean>;
  temp: 'frigid' | 'cold' | 'ambient' | 'warm' | 'hot' | 'incandescent';
  tags: string[];
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC' | 'MYTHIC' | 'ANOMALOUS';
  lifePotential: number;
  explanation: string;
  sprite: {
    shape: 'droplet' | 'crystal' | 'powder' | 'rock' | 'ingot' | 'flora' | 'fluid' | 'sparks' | 'orb' | 'vapor' | 'curio';
    primary: string;
    secondary: string;
    accent: string;
  };
  triggersOddkin?: boolean;
}

const CANONICAL_FOUNDRY_RECIPES: CanonicalRecipe[] = [
  // Depth 1: Foundational Matter
  {
    inputs: ['SOIL', 'WATER'],
    process: 'MIX',
    resultName: 'Mud',
    category: 'Mineral',
    stateOfMatter: 'amorphous',
    properties: { organic: true, mineral: true, liquid: false, porous: true },
    temp: 'ambient',
    tags: ['earth', 'wet', 'slurry', 'loam', 'viscous'],
    rarity: 'COMMON',
    lifePotential: 45,
    explanation: 'Blending fine silt with water forms a thick, malleable alluvial mud.',
    sprite: { shape: 'fluid', primary: '#5c3317', secondary: '#3d220f', accent: '#8b5a2b' }
  },
  {
    inputs: ['MUD'],
    process: 'DRY',
    resultName: 'Clay',
    category: 'Mineral',
    stateOfMatter: 'solid',
    properties: { mineral: true, porous: true, fragile: false, elastic: true },
    temp: 'ambient',
    tags: ['mineral', 'sculptable', 'dense', 'silicate', 'earth'],
    rarity: 'COMMON',
    lifePotential: 42,
    explanation: 'Desiccating mud evaporates loose pore moisture, leaving dense sculptable clay.',
    sprite: { shape: 'rock', primary: '#b45309', secondary: '#78350f', accent: '#d97706' }
  },
  {
    inputs: ['CLAY'],
    process: 'HEAT',
    resultName: 'Ceramic',
    category: 'Composite',
    stateOfMatter: 'solid',
    properties: { mineral: true, fragile: true, synthetic: true, conductive: false },
    temp: 'ambient',
    tags: ['hard', 'vitrified', 'brittle', 'vessel', 'kiln'],
    rarity: 'UNCOMMON',
    lifePotential: 20,
    explanation: 'Intense thermal firing fuses clay particles into a rigid, non-porous ceramic.',
    sprite: { shape: 'curio', primary: '#e2e8f0', secondary: '#94a3b8', accent: '#3b82f6' }
  },
  {
    inputs: ['WATER'],
    process: 'FREEZE',
    resultName: 'Ice',
    category: 'Elemental',
    stateOfMatter: 'solid',
    properties: { mineral: true, crystalline: true, fragile: true },
    temp: 'frigid',
    tags: ['cold', 'frozen', 'glacier', 'lattice', 'solid'],
    rarity: 'COMMON',
    lifePotential: 15,
    explanation: 'Sub-zero temperatures lock liquid water into a hexagonal crystalline lattice of ice.',
    sprite: { shape: 'crystal', primary: '#93c5fd', secondary: '#3b82f6', accent: '#ffffff' }
  },
  {
    inputs: ['WATER'],
    process: 'HEAT',
    resultName: 'Steam',
    category: 'Elemental',
    stateOfMatter: 'gas',
    properties: { gaseous: true, conductive: false },
    temp: 'hot',
    tags: ['vapor', 'kinetic', 'pressure', 'cloud', 'thermal'],
    rarity: 'COMMON',
    lifePotential: 25,
    explanation: 'Boiling thermal energy vaporizes water into expanding gaseous steam.',
    sprite: { shape: 'vapor', primary: '#cbd5e1', secondary: '#94a3b8', accent: '#f8fafc' }
  },
  {
    inputs: ['STEAM'],
    process: 'FREEZE',
    resultName: 'Distilled Water',
    category: 'Elemental',
    stateOfMatter: 'liquid',
    properties: { liquid: true, conductive: false, transparent: true },
    temp: 'ambient',
    tags: ['pure', 'condensed', 'clear', 'distilled'],
    rarity: 'COMMON',
    lifePotential: 20,
    explanation: 'Rapid condensation returns gaseous steam into pure, demineralized water.',
    sprite: { shape: 'droplet', primary: '#60a5fa', secondary: '#2563eb', accent: '#dbeafe' }
  },
  {
    inputs: ['ICE'],
    process: 'HEAT',
    resultName: 'Meltwater',
    category: 'Elemental',
    stateOfMatter: 'liquid',
    properties: { liquid: true, conductive: false },
    temp: 'cold',
    tags: ['fresh', 'thaw', 'liquid', 'chilled'],
    rarity: 'COMMON',
    lifePotential: 25,
    explanation: 'Thermal energy breaks the rigid ice lattice into clear, chilled meltwater.',
    sprite: { shape: 'droplet', primary: '#38bdf8', secondary: '#0284c7', accent: '#f0f9ff' }
  },
  {
    inputs: ['PLANT'],
    process: 'DRY',
    resultName: 'Fiber',
    category: 'Organic',
    stateOfMatter: 'solid',
    properties: { organic: true, flammable: true, porous: true, elastic: true },
    temp: 'ambient',
    tags: ['cellulose', 'woven', 'thread', 'dry', 'tough'],
    rarity: 'COMMON',
    lifePotential: 52,
    explanation: 'Dehydrating cellular flora extracts moisture, yielding resilient cellulose fiber strands.',
    sprite: { shape: 'powder', primary: '#ca8a04', secondary: '#854d0e', accent: '#fef08a' }
  },
  {
    inputs: ['FIBER'],
    process: 'MIX',
    resultName: 'Twine',
    category: 'Composite',
    stateOfMatter: 'solid',
    properties: { organic: true, flammable: true, elastic: true },
    temp: 'ambient',
    tags: ['cord', 'twisted', 'binding', 'strong'],
    rarity: 'COMMON',
    lifePotential: 35,
    explanation: 'Twisting dry fiber strands together forms tensile cordage.',
    sprite: { shape: 'curio', primary: '#a16207', secondary: '#713f12', accent: '#fef08a' }
  },
  {
    inputs: ['STONE'],
    process: 'CRUSH',
    resultName: 'Sand',
    category: 'Mineral',
    stateOfMatter: 'solid',
    properties: { mineral: true, fragile: true, crystalline: true },
    temp: 'ambient',
    tags: ['silica', 'granular', 'desert', 'grit', 'sediment'],
    rarity: 'COMMON',
    lifePotential: 18,
    explanation: 'High mechanical force pulverizes dense stone into microscopic quartz grains.',
    sprite: { shape: 'powder', primary: '#fde047', secondary: '#ca8a04', accent: '#fef9c3' }
  },
  {
    inputs: ['SAND'],
    process: 'HEAT',
    resultName: 'Glass',
    category: 'Mineral',
    stateOfMatter: 'solid',
    properties: { mineral: true, fragile: true, crystalline: false, conductive: false },
    temp: 'ambient',
    tags: ['transparent', 'silica', 'smooth', 'vitreous', 'brittle'],
    rarity: 'UNCOMMON',
    lifePotential: 22,
    explanation: 'Extreme thermal energy melts silica grains together into amorphous, transparent glass.',
    sprite: { shape: 'crystal', primary: '#38bdf8', secondary: '#0284c7', accent: '#e0f2fe' }
  },
  {
    inputs: ['STONE'],
    process: 'HEAT',
    resultName: 'Magma',
    category: 'Mineral',
    stateOfMatter: 'liquid',
    properties: { mineral: true, conductive: true, liquid: true },
    temp: 'incandescent',
    tags: ['molten', 'lava', 'volcanic', 'thermal', 'heavy'],
    rarity: 'UNCOMMON',
    lifePotential: 35,
    explanation: 'Intense crucible heating liquefies metamorphic stone into glowing molten magma.',
    sprite: { shape: 'fluid', primary: '#ef4444', secondary: '#991b1b', accent: '#fbbf24' }
  },
  {
    inputs: ['MAGMA', 'WATER'],
    process: 'SOAK',
    resultName: 'Obsidian',
    category: 'Mineral',
    stateOfMatter: 'solid',
    properties: { mineral: true, fragile: true, crystalline: false },
    temp: 'ambient',
    tags: ['volcanic', 'vitreous', 'sharp', 'dark', 'dense'],
    rarity: 'UNCOMMON',
    lifePotential: 28,
    explanation: 'Quenching red-hot magma rapidly in cold water freezes it into glossy black volcanic glass.',
    sprite: { shape: 'crystal', primary: '#0f172a', secondary: '#020617', accent: '#64748b' }
  },
  {
    inputs: ['PLANT', 'WATER'],
    process: 'FERMENT',
    resultName: 'Enzyme Broth',
    category: 'Biological',
    stateOfMatter: 'liquid',
    properties: { organic: true, liquid: true, edible: true },
    temp: 'warm',
    tags: ['microbial', 'ferment', 'active', 'culture', 'vitality'],
    rarity: 'UNCOMMON',
    lifePotential: 75,
    explanation: 'Bacterial cultures ferment the plant sugars in aqueous suspension, creating living enzymes.',
    sprite: { shape: 'fluid', primary: '#15803d', secondary: '#166534', accent: '#86efac' }
  },
  {
    inputs: ['METAL', 'WATER'],
    process: 'SOAK',
    resultName: 'Rust',
    category: 'Metallic',
    stateOfMatter: 'solid',
    properties: { metallic: true, mineral: true, fragile: true },
    temp: 'ambient',
    tags: ['oxidized', 'ferric', 'flaking', 'red', 'weathered'],
    rarity: 'COMMON',
    lifePotential: 28,
    explanation: 'Moisture exposure oxidizes metallic bonds into brittle red ferric oxide.',
    sprite: { shape: 'powder', primary: '#c2410c', secondary: '#7c2d12', accent: '#fb923c' }
  },
  {
    inputs: ['METAL'],
    process: 'HEAT',
    resultName: 'Molten Ingot',
    category: 'Metallic',
    stateOfMatter: 'liquid',
    properties: { metallic: true, conductive: true, liquid: true },
    temp: 'incandescent',
    tags: ['smelted', 'liquefied', 'crucible', 'forge'],
    rarity: 'UNCOMMON',
    lifePotential: 24,
    explanation: 'Furnace temperatures liquefy the metallic lattice into free-flowing liquid alloy.',
    sprite: { shape: 'fluid', primary: '#f97316', secondary: '#c2410c', accent: '#fef08a' }
  },
  {
    inputs: ['PLANT'],
    process: 'HEAT',
    resultName: 'Charcoal',
    category: 'Mineral',
    stateOfMatter: 'solid',
    properties: { organic: true, flammable: true, porous: true, mineral: true },
    temp: 'ambient',
    tags: ['carbon', 'pyrolysis', 'fuel', 'black', 'porous'],
    rarity: 'COMMON',
    lifePotential: 30,
    explanation: 'Oxygen-deprived pyrolysis chars plant matter into pure porous carbon.',
    sprite: { shape: 'rock', primary: '#1e293b', secondary: '#0f172a', accent: '#475569' }
  },
  {
    inputs: ['CHARCOAL', 'WATER'],
    process: 'CRUSH',
    resultName: 'Carbon Ink',
    category: 'Composite',
    stateOfMatter: 'liquid',
    properties: { liquid: true, porous: false },
    temp: 'ambient',
    tags: ['pigment', 'scribing', 'black', 'indelible'],
    rarity: 'COMMON',
    lifePotential: 32,
    explanation: 'Grinding fine charcoal particles into suspension yields permanent black drafting ink.',
    sprite: { shape: 'droplet', primary: '#09090b', secondary: '#18181b', accent: '#52525b' }
  },
  {
    inputs: ['SOIL', 'PLANT'],
    process: 'INCUBATE',
    resultName: 'Humus Spore Bed',
    category: 'Biological',
    stateOfMatter: 'solid',
    properties: { organic: true, living: true, porous: true },
    temp: 'warm',
    tags: ['mycelium', 'spores', 'rich', 'fertile', 'living'],
    rarity: 'UNCOMMON',
    lifePotential: 82,
    explanation: 'Gentle warmth awakens dormant mycelial filaments in the nutrient-dense loam.',
    sprite: { shape: 'flora', primary: '#059669', secondary: '#064e3b', accent: '#a7f3d0' }
  }
];

// Helper to canonicalize two input names regardless of order
function getRecipeKey(a: string, b: string | undefined, proc: string): string {
  const normA = a.trim().toUpperCase();
  const normProc = proc.trim().toUpperCase();
  if (!b) return `${normA}+${normProc}`;
  const normB = b.trim().toUpperCase();
  const sorted = [normA, normB].sort();
  return `${sorted[0]}+${sorted[1]}+${normProc}`;
}

// Synthesis endpoint
app.post('/api/synthesize', async (req, res) => {
  try {
    const { inputMaterialA, inputMaterialB, process, existingMaterialNames, knownOddkinNames, recentLineageContext } = req.body;

    if (!validMaterial(inputMaterialA) || (inputMaterialB && !validMaterial(inputMaterialB)) || !process || !text(process.id) || !text(process.name)) {
      return res.status(400).json({ error: 'Missing inputMaterialA or process' });
    }

    const normA = inputMaterialA.canonicalName.toUpperCase();
    const normB = inputMaterialB ? inputMaterialB.canonicalName.toUpperCase() : undefined;
    const normProc = process.id.toUpperCase();
    const currentDepth = Math.max(
      inputMaterialA.lineage?.depth || 0,
      inputMaterialB?.lineage?.depth || 0
    ) + 1;

    // Check life potential
    const combinedLifePotential = Math.round(
      ((inputMaterialA.lifePotential || 30) + (inputMaterialB?.lifePotential || 0)) / (inputMaterialB ? 1.6 : 1.0)
    );

    // Check if process is bio-catalytic (INCUBATE, GROW, FERMENT) or combines spark/energy with living/organic materials
    const isBioProcess = ['INCUBATE', 'GROW', 'FERMENT'].includes(normProc);
    const hasLivingOrOrganic = inputMaterialA.properties?.organic || inputMaterialA.properties?.living ||
      inputMaterialB?.properties?.organic || inputMaterialB?.properties?.living;
    const hasEnergyOrCatalyst = normA === 'SPARK' || normB === 'SPARK' || normProc === 'CHARGE' || isBioProcess;

    // Life emergence conditions:
    // 1. High life potential (>= 75) AND (isBioProcess OR (hasLivingOrOrganic && hasEnergyOrCatalyst))
    // 2. Or explicit deep lineage incubation
    const shouldEmergeOddkin = (combinedLifePotential >= 75 && (isBioProcess || hasEnergyOrCatalyst)) ||
      (currentDepth >= 3 && isBioProcess && hasLivingOrOrganic);

    // 1. Instant Canonical Engine Lookup (Fastest, deterministic & zero latency)
    const matchingRecipe = CANONICAL_FOUNDRY_RECIPES.find(r => {
      const sortedReq = [...r.inputs].sort();
      const currentInputs = [normA, ...(normB ? [normB] : [])].sort();
      if (sortedReq.length !== currentInputs.length) return false;
      const inputsMatch = sortedReq.every((val, idx) => val === currentInputs[idx]);
      return inputsMatch && r.process === normProc;
    });

    if (matchingRecipe) {
      const newMat = {
        id: `mat_${matchingRecipe.resultName.toLowerCase().replace(/\s+/g, '_')}`,
        canonicalName: matchingRecipe.resultName.toUpperCase(),
        displayName: matchingRecipe.resultName,
        description: matchingRecipe.explanation,
        category: matchingRecipe.category,
        subcategory: 'Synthesized Compound',
        stateOfMatter: matchingRecipe.stateOfMatter,
        properties: {
          organic: false, living: false, edible: false, metallic: false, mineral: false,
          liquid: false, gaseous: false, crystalline: false, synthetic: false, conductive: false,
          magnetic: false, flammable: false, toxic: false, fragile: false, elastic: false, porous: false,
          ...matchingRecipe.properties,
        },
        temperatureClass: matchingRecipe.temp,
        semanticTags: matchingRecipe.tags,
        lineage: {
          parentIds: [inputMaterialA.id, ...(inputMaterialB ? [inputMaterialB.id] : [])],
          processId: process.id,
          depth: currentDepth,
          generation: (inputMaterialA.lineage?.generation || 0) + 1,
          recipeDesc: `${inputMaterialA.displayName} ${inputMaterialB ? `+ ${inputMaterialB.displayName}` : ''} (${process.name})`
        },
        rarity: matchingRecipe.rarity,
        discoveredAt: Date.now(),
        possibleProcessAffinities: ['HEAT', 'DRY', 'MIX', 'CRUSH', 'SOAK', 'INCUBATE'],
        lifePotential: matchingRecipe.lifePotential,
        spriteDescriptor: {
          palette: [matchingRecipe.sprite.secondary, matchingRecipe.sprite.primary, matchingRecipe.sprite.accent],
          baseShape: matchingRecipe.sprite.shape,
          primaryColor: matchingRecipe.sprite.primary,
          secondaryColor: matchingRecipe.sprite.secondary,
          accentColor: matchingRecipe.sprite.accent,
        },
        discoveryExplanation: matchingRecipe.explanation,
      };

      return res.json({
        status: 'new_material',
        material: newMat,
        explanation: matchingRecipe.explanation,
      });
    }

    // 2. Gemini Generative Synthesis Engine (with automatic multi-model failover)
    const prompt = `You are the synthesis engine for ODDKIN FOUNDRY, an original scientific and fantastical crafting game where EVERYTHING HAS LINEAGE.
DISCOVER MATTER. CREATE LIFE.

INPUT A:
- Name: ${inputMaterialA.displayName} (${inputMaterialA.canonicalName})
- Category: ${inputMaterialA.category}
- State: ${inputMaterialA.stateOfMatter}
- Properties: ${JSON.stringify(inputMaterialA.properties)}
- Lineage: ${inputMaterialA.lineage?.recipeDesc || 'None'} (Depth: ${inputMaterialA.lineage?.depth || 0})

${inputMaterialB ? `INPUT B:
- Name: ${inputMaterialB.displayName} (${inputMaterialB.canonicalName})
- Category: ${inputMaterialB.category}
- State: ${inputMaterialB.stateOfMatter}
- Properties: ${JSON.stringify(inputMaterialB.properties)}
- Lineage: ${inputMaterialB.lineage?.recipeDesc || 'None'}` : 'INPUT B: None'}

APPLIED PROCESS: ${process.name} (${process.verb})
CURRENT RECIPE DEPTH: ${currentDepth}
LIFE POTENTIAL CONTEXT: ${combinedLifePotential}
EXISTING DISCOVERED MATERIALS: ${(existingMaterialNames || []).slice(-25).join(', ')}
KNOWN ODDKIN: ${(knownOddkinNames || []).join(', ')}

RULES & CRITIQUE:
1. SEMANTIC COHERENCE: Does the process logically affect these inputs? (Heat on stone melts it into Lava or cracks it; Dry on mud yields Clay; Freeze on water yields Ice). Do not produce arbitrary word associations.
2. CANONICALIZATION: If this recipe results in something semantically identical to an existing discovered material, reuse that canonical name!
3. REALITY -> FANTASY GRADIENT: At Depth 0-3, results should be mostly recognizable materials (ceramics, alloys, crystals, distillates, glass, charcoal, fibers). At Depth 4-8, unusual composites and speculative matter. At Depth 9+, strange anomalies.
4. LIFE EMERGENCE: If and only if conditions are rich in bio-potential (${shouldEmergeOddkin ? 'YES, QUALIFIES FOR ODDKIN LIFE EMERGENCE' : 'No, should create a material or no reaction'}), generate an ODDKIN creature whose entire body plan, anatomy, traits, and texture are derived from this exact lineage (${inputMaterialA.displayName} + ${inputMaterialB?.displayName || 'None'} + ${process.name}).

Format your response as a strict JSON object with this structure:
{
  "status": "${shouldEmergeOddkin ? 'life_emergence' : 'new_material'}",
  "material": {
    "canonicalName": "UPPERCASE_CANONICAL_NAME",
    "displayName": "Title Case Name",
    "description": "1-2 sentences on physical traits and composition",
    "category": "Mineral/Elemental/Organic/Metallic/Composite/Energy/Biological",
    "subcategory": "Specific classification",
    "stateOfMatter": "solid/liquid/gas/plasma/amorphous",
    "properties": {
      "organic": boolean,
      "living": boolean,
      "edible": boolean,
      "metallic": boolean,
      "mineral": boolean,
      "liquid": boolean,
      "gaseous": boolean,
      "crystalline": boolean,
      "synthetic": boolean,
      "conductive": boolean,
      "magnetic": boolean,
      "flammable": boolean,
      "toxic": boolean,
      "fragile": boolean,
      "elastic": boolean,
      "porous": boolean
    },
    "temperatureClass": "frigid/cold/ambient/warm/hot/incandescent",
    "semanticTags": ["tag1", "tag2"],
    "rarity": "COMMON/UNCOMMON/RARE/EXOTIC/MYTHIC/ANOMALOUS",
    "lifePotential": number (0-100),
    "spriteDescriptor": {
      "palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
      "baseShape": "droplet/crystal/powder/rock/ingot/flora/fluid/sparks/orb/vapor/curio",
      "primaryColor": "#hex",
      "secondaryColor": "#hex",
      "accentColor": "#hex"
    },
    "discoveryExplanation": "Short player-facing explanation of how the process affected the inputs"
  },
  "oddkin": {
    "speciesName": "Name of Oddkin species (completely original, NO pokemon names)",
    "titleOrClassification": "e.g. Silt-Sprout Entity, Pyretic Beetle, Sporeling",
    "description": "Biological notes showing visible lineage from ingredients",
    "rarity": "COMMON/UNCOMMON/RARE/EXOTIC/MYTHIC/ANOMALOUS",
    "morphology": {
      "bodyPlan": "quadruped/biped/blob/serpentine/insectoid/avian/floating_orb/fungoid",
      "symmetry": "bilateral/radial/asymmetrical",
      "limbs": number,
      "appendages": ["horns", "wings", "antennae", "etc"],
      "surface": "chitin/fur/scales/bark/molten/gelatinous/crystalline/metallic/stone/spore",
      "material": "Composition derived from lineage",
      "locomotion": "walk/hop/float/crawl/slither/scuttle"
    },
    "physiology": {
      "metabolism": "Endothermic/Chemosynthetic/etc",
      "diet": "What it consumes",
      "environment": "Preferred habitat",
      "energySource": "Thermal/Nutrient/Electrostatic/etc"
    },
    "temperament": "curious/skittish/docile/fiery/ponderous",
    "affinities": ["earth", "aquatic", "pyro", "flora", "etc"],
    "inheritedMaterialTraits": ["Trait from parent A", "Trait from parent B"],
    "mutations": [],
    "transformationPotential": {
      "possible": boolean,
      "hint": "Cryptic hint on how it might transform"
    },
    "habitatPreferences": ["woodland", "workshop", "bog", "garden"],
    "spriteSpecification": {
      "palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
      "outlineColor": "#101216",
      "silhouetteType": "compact/spiky/bulbous/slender",
      "eyeStyle": "beady/slits/luminescent/single/gentle",
      "featureDetails": ["feature1", "feature2"],
      "primaryColor": "#hex",
      "secondaryColor": "#hex",
      "accentColor": "#hex"
    },
    "chirpToneHz": 480
  },
  "explanation": "Player-facing summary of why this reaction succeeded"
}`;

    const rawResponse = await callGeminiStructured(prompt);
    if (rawResponse) {
      try {
        const parsed = JSON.parse(rawResponse);
        if (parsed.status === 'no_reaction' && text(parsed.explanation)) {
          return res.json({ status: 'no_reaction', explanation: parsed.explanation, observationIfFailed: parsed.explanation });
        }
        if (parsed.status === 'life_emergence' && parsed.oddkin) {
          const oddkinObj = {
            ...parsed.oddkin,
            speciesId: `odd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            ancestryTags: [
              ...inputMaterialA.semanticTags,
              ...(inputMaterialB?.semanticTags || []),
              process.name.toLowerCase()
            ],
            lineage: {
              parentMaterialIds: [inputMaterialA.id, ...(inputMaterialB ? [inputMaterialB.id] : [])],
              catalystProcessId: process.id,
              depth: currentDepth,
              fullAncestryChain: [
                {
                  step: currentDepth,
                  inputs: [inputMaterialA.displayName, ...(inputMaterialB ? [inputMaterialB.displayName] : [])],
                  process: process.name,
                  result: parsed.oddkin.speciesName,
                }
              ]
            },
            discoveredAt: Date.now(),
            encounterCount: 1,
            variantFormsDiscovered: ['standard'],
          };
          if (!validOddkin(oddkinObj)) throw new ApiFailure(502, 'AI returned an incomplete creature. Please retry.');
          return res.json({
            status: 'life_emergence',
            oddkin: oddkinObj,
            explanation: parsed.explanation || parsed.oddkin.description,
          });
        } else if (parsed.material) {
          const matObj = {
            ...parsed.material,
            id: `mat_${parsed.material.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
            lineage: {
              parentIds: [inputMaterialA.id, ...(inputMaterialB ? [inputMaterialB.id] : [])],
              processId: process.id,
              depth: currentDepth,
              generation: (inputMaterialA.lineage?.generation || 0) + 1,
              recipeDesc: `${inputMaterialA.displayName} ${inputMaterialB ? `+ ${inputMaterialB.displayName}` : ''} (${process.name})`
            },
            discoveredAt: Date.now(),
            possibleProcessAffinities: ['HEAT', 'MIX', 'SOAK', 'CRUSH', 'INCUBATE'],
          };
          if (!validMaterial(matObj)) throw new ApiFailure(502, 'AI returned an incomplete material. Please retry.');
          return res.json({
            status: 'new_material',
            material: matObj,
            explanation: parsed.material.discoveryExplanation || parsed.explanation,
          });
        }
      } catch {
        // Reject malformed generation below.
      }
    }

    throw new ApiFailure(502, 'AI returned an incomplete discovery. Please retry.');

  } catch (err: unknown) {
    console.error('Synthesis error:', err);
    const failure = publicFailure(err);
    res.status(failure.status).json({ error: failure.error });
  }
});

// Photo Seed endpoint (Gemini Multimodal Vision with failover)
app.post('/api/photo-seed', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this real-world photograph for the game ODDKIN FOUNDRY.
Convert the primary visible object or substance conservatively into an elemental or manufactured crafting material seed.
Do not pretend to be 100% scientifically infallible, identify the tangible material (e.g. "RUSTY WASHER", "MAPLE LEAF", "COFFEE GROUNDS", "RIVER PEBBLE", "COPPER WIRE", "COTTON CLOTH").

Return a strict JSON object:
{
  "canonicalName": "UPPERCASE_NAME",
  "displayName": "Title Case Name",
  "description": "1 sentence describing its physical texture, material, and origin",
  "category": "Mineral/Organic/Metallic/Composite/Elemental",
  "stateOfMatter": "solid/liquid/gas/amorphous",
  "properties": {
    "organic": boolean,
    "metallic": boolean,
    "mineral": boolean,
    "conductive": boolean,
    "flammable": boolean,
    "porous": boolean,
    "crystalline": boolean
  },
  "temperatureClass": "ambient",
  "semanticTags": ["tag1", "tag2", "tag3"],
  "rarity": "UNCOMMON",
  "lifePotential": number (10-70),
  "discoveryExplanation": "Optical sensor digitized physical specimen into active material matrix.",
  "spriteDescriptor": {
    "palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
    "baseShape": "rock/ingot/flora/powder/curio/crystal",
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex"
  }
}`;

    const rawVisionJson = await callGeminiStructured({
      parts: [
        { inlineData: { mimeType, data: cleanBase64 } },
        { text: prompt },
      ],
    });

    if (rawVisionJson) {
      try {
        const parsed = JSON.parse(rawVisionJson);
        if (!record(parsed) || !['canonicalName','displayName','description','category','stateOfMatter','discoveryExplanation'].every(k => text(parsed[k])) || !record(parsed.properties) || !strings(parsed.semanticTags) || !validSprite(parsed.spriteDescriptor)) throw new Error('Invalid photo result');
        return res.json(parsed);
      } catch {
        // Reject malformed generation below.
      }
    }

    throw new ApiFailure(502, 'The photo could not be identified. Please retry.');
  } catch (err: unknown) {
    console.error('Photo seed error:', err);
    const failure = publicFailure(err);
    res.status(failure.status).json({ error: failure.error });
  }
});

// Sketch Seed endpoint (Gemini Multimodal Sketch Interpretation with failover)
app.post('/api/sketch-seed', async (req, res) => {
  try {
    const { drawingBase64 } = req.body;
    if (!drawingBase64) {
      return res.status(400).json({ error: 'Missing drawingBase64' });
    }

    const cleanBase64 = drawingBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Look at this player doodle/sketch for the game ODDKIN FOUNDRY.
Instead of turning it directly into a monster, extract the latent visual morphology hints (e.g. spirals, multi-eyes, horns, wings, radial symmetry, spiky or round silhouette, dominant color hues).

Return a strict JSON object:
{
  "conceptName": "Name of the glyph/sketch form",
  "traits": ["trait1", "trait2", "trait3"],
  "morphologyHints": {
    "bodyPlan": "quadruped/biped/blob/serpentine/insectoid/avian/floating_orb/fungoid",
    "surface": "chitin/fur/scales/bark/molten/gelatinous/crystalline/metallic",
    "feature": "specific unique feature spotted in doodle",
    "primaryColor": "#hex"
  },
  "lifePotentialBonus": number (20-45)
}`;

    const rawSketchJson = await callGeminiStructured({
      parts: [
        { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
        { text: prompt },
      ],
    });

    if (rawSketchJson) {
      try {
        const parsed = JSON.parse(rawSketchJson);
        if (!record(parsed) || !text(parsed.conceptName) || !strings(parsed.traits) || !record(parsed.morphologyHints) || !['bodyPlan','surface','feature'].every(k => text(parsed.morphologyHints[k])) || !color(parsed.morphologyHints.primaryColor) || !finite(parsed.lifePotentialBonus)) throw new Error('Invalid sketch result');
        return res.json(parsed);
      } catch {
        // Reject malformed generation below.
      }
    }

    throw new ApiFailure(502, 'The sketch could not be interpreted. Please retry.');
  } catch (err: unknown) {
    console.error('Sketch seed error:', err);
    const failure = publicFailure(err);
    res.status(failure.status).json({ error: failure.error });
  }
});

// Voice Intent Parsing endpoint with failover
app.post('/api/voice-intent', async (req, res) => {
  try {
    const { transcript, availableMaterials, availableProcesses } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Missing transcript' });
    }

    const prompt = `The player said into the Oddkin Foundry microphone: "${transcript}"
Available materials: ${JSON.stringify(availableMaterials?.map((m: { id: string; displayName: string }) => ({ id: m.id, name: m.displayName })) || [])}
Available processes: ${JSON.stringify(availableProcesses?.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) || [])}

Map this voice query to the structured game action.
Return a strict JSON object:
{
  "recognized": boolean,
  "processId": "ID of process or null",
  "materialAId": "ID of first material or null",
  "materialBId": "ID of second material or null",
  "action": "synthesize" | "inspect" | "archive"
}`;

    const rawVoiceJson = await callGeminiStructured(prompt);
    if (rawVoiceJson) {
      try {
        const parsed = JSON.parse(rawVoiceJson);
        return res.json(parsed);
      } catch {
        // Fall through to local keyword matching
      }
    }

    // Local keyword matching fallback
    const t = transcript.toLowerCase();
    const matchedProc = availableProcesses?.find((p: { name: string; id: string }) =>
      t.includes(p.name.toLowerCase()) || t.includes(p.id.toLowerCase())
    );
    const matchedMats = availableMaterials?.filter((m: { displayName: string }) =>
      t.includes(m.displayName.toLowerCase())
    );

    return res.json({
      recognized: Boolean(matchedProc && matchedMats?.length > 0),
      processId: matchedProc?.id,
      materialAId: matchedMats?.[0]?.id,
      materialBId: matchedMats?.[1]?.id,
      action: 'synthesize',
    });
  } catch (err: unknown) {
    console.error('Voice intent error:', err);
    const failure = publicFailure(err);
    res.status(failure.status).json({ error: failure.error });
  }
});

// Production static serving & Vite development middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Oddkin Foundry server running on http://0.0.0.0:${PORT}`);
  });
}

// Vercel invokes the exported app through api/index.ts; it owns the listener.
if (process.env.NODE_ENV !== 'test' && process.env.VERCEL !== '1') startServer();
