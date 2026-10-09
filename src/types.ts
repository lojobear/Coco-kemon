/**
 * ODDKIN FOUNDRY - Core Type Definitions
 * DISCOVER MATTER. CREATE LIFE.
 */

export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC' | 'MYTHIC' | 'ANOMALOUS';

export type StateOfMatter = 'solid' | 'liquid' | 'gas' | 'plasma' | 'amorphous' | 'energy';

export type TemperatureClass = 'frigid' | 'cold' | 'ambient' | 'warm' | 'hot' | 'incandescent';

export interface MaterialProperties {
  organic: boolean;
  living: boolean;
  edible: boolean;
  metallic: boolean;
  mineral: boolean;
  liquid: boolean;
  gaseous: boolean;
  crystalline: boolean;
  synthetic: boolean;
  conductive: boolean;
  magnetic: boolean;
  flammable: boolean;
  toxic: boolean;
  fragile: boolean;
  elastic: boolean;
  porous: boolean;
}

export interface MaterialLineage {
  parentIds: string[];
  processId?: string;
  depth: number;
  generation: number;
  recipeDesc?: string;
}

export interface SpriteDescriptor {
  palette: string[];
  baseShape: 'droplet' | 'crystal' | 'powder' | 'rock' | 'ingot' | 'flora' | 'fluid' | 'sparks' | 'orb' | 'vapor' | 'curio';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  glow?: boolean;
  pixelGrid?: number[][]; // Optional cached 64x64 or 16x16 index grid
}

export interface Material {
  id: string;
  canonicalName: string;
  displayName: string;
  description: string;
  category: string;
  subcategory: string;
  stateOfMatter: StateOfMatter;
  properties: MaterialProperties;
  temperatureClass: TemperatureClass;
  semanticTags: string[];
  lineage: MaterialLineage;
  rarity: Rarity;
  discoveredAt: number;
  possibleProcessAffinities: string[];
  lifePotential: number; // Hidden score (0-100)
  spriteDescriptor: SpriteDescriptor;
  discoveryExplanation: string;
  customSpriteUrl?: string;
  spriteRendererVersion?: number;
  variant?: 'holographic' | 'ancient' | 'glitched' | 'corrupted';
  xpBonus?: number;
}

export type ProcessCategory = 'Thermal' | 'Mechanical' | 'Biological' | 'Electromagnetic' | 'Alchemical' | 'Temporal' | 'Pressure';

export interface Process {
  id: string;
  name: string;
  verb: string;
  description: string;
  category: ProcessCategory;
  symbol: string;
  unlocked: boolean;
}

export interface OddkinMorphology {
  bodyPlan: 'quadruped' | 'biped' | 'blob' | 'serpentine' | 'insectoid' | 'avian' | 'floating_orb' | 'fungoid';
  symmetry: 'bilateral' | 'radial' | 'asymmetrical';
  limbs: number;
  appendages: string[];
  surface: 'chitin' | 'fur' | 'scales' | 'bark' | 'molten' | 'gelatinous' | 'crystalline' | 'metallic' | 'stone' | 'spore';
  material: string;
  locomotion: 'walk' | 'hop' | 'float' | 'crawl' | 'slither' | 'scuttle';
}

export interface OddkinPhysiology {
  metabolism: string;
  diet: string;
  environment: string;
  energySource: string;
}

export interface OddkinAncestryStep {
  step: number;
  inputs: string[];
  process: string;
  result: string;
}

export interface OddkinSpriteSpecification {
  palette: string[];
  outlineColor: string;
  silhouetteType: string;
  eyeStyle: 'beady' | 'slits' | 'luminescent' | 'compound' | 'single' | 'gentle';
  featureDetails: string[];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  isChroma?: boolean;
  isAnomalous?: boolean;
}

export interface Oddkin {
  speciesId: string;
  speciesName: string;
  titleOrClassification: string;
  description: string;
  rarity: Rarity;
  ancestryTags: string[];
  lineage: {
    parentMaterialIds: string[];
    catalystProcessId: string;
    depth: number;
    fullAncestryChain: OddkinAncestryStep[];
  };
  morphology: OddkinMorphology;
  physiology: OddkinPhysiology;
  temperament: string;
  affinities: string[];
  inheritedMaterialTraits: string[];
  mutations: string[];
  transformationPotential: {
    possible: boolean;
    hint?: string;
    transformedSpeciesId?: string;
    condition?: string;
  };
  habitatPreferences: string[];
  spriteSpecification: OddkinSpriteSpecification;
  discoveredAt: number;
  encounterCount: number;
  variantFormsDiscovered: ('standard' | 'chroma' | 'anomalous')[];
  isChromaActive?: boolean;
  currentHabitatId?: string;
  chirpToneHz: number;
  customSpriteUrl?: string;
}

export interface ExperimentLog {
  id: string;
  timestamp: number;
  inputNames: string[];
  processName: string;
  success: boolean;
  resultName?: string;
  isOddkinEmergence?: boolean;
  observation: string;
  hint?: string;
  wasNew?: boolean;
  rarity?: Rarity;
  category?: string;
  variant?: 'holographic' | 'ancient' | 'glitched' | 'corrupted';
}

export interface Habitat {
  id: string;
  name: string;
  type: 'woodland' | 'bog' | 'workshop' | 'ruins' | 'cavern' | 'shore' | 'garden';
  themePalette: {
    sky: string;
    ground: string;
    accent: string;
    foliage: string;
  };
  description: string;
  residentOddkinIds: string[];
  lastHarvestTimestamp: number;
  pendingDiscovery?: {
    materialName: string;
    reason: string;
  };
}

export interface SynthesisRequest {
  inputMaterialA: Material;
  inputMaterialB?: Material;
  process: Process;
  existingMaterialNames: string[];
  knownOddkinNames: string[];
  recentLineageContext?: string[];
}

export interface SynthesisResult {
  status: 'new_material' | 'existing_material' | 'life_emergence' | 'no_reaction';
  material?: Material;
  oddkin?: Oddkin;
  explanation: string;
  observationIfFailed?: string;
  hintIfFailed?: string;
  isChroma?: boolean;
}

export interface PhotoSeedResult {
  canonicalName: string;
  displayName: string;
  description: string;
  category: string;
  stateOfMatter: StateOfMatter;
  properties: MaterialProperties;
  temperatureClass: TemperatureClass;
  semanticTags: string[];
  spriteDescriptor: SpriteDescriptor;
  discoveryExplanation: string;
}

export interface SketchSeedResult {
  conceptName: string;
  traits: string[];
  morphologyHints: {
    bodyPlan: string;
    surface: string;
    feature: string;
    primaryColor: string;
  };
  lifePotentialBonus: number;
}
