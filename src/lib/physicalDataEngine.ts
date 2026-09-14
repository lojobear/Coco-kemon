/**
 * PHYSICAL PROPERTIES & DATA ENGINE + SHINY VARIANT SYSTEM
 * Provides exhaustive, scientifically grounded & cosmic physical data for any element,
 * plus a Pokémon-style shiny variant generation, odds calculator, and holographic styling.
 */

export type StateOfMatterType =
  | 'Solid'
  | 'Liquid'
  | 'Gas'
  | 'Plasma'
  | 'Supercritical Fluid'
  | 'Amorphous Solid'
  | 'Bose-Einstein Condensate'
  | 'Tachyonic Energy'
  | 'Degenerate Matter'
  | 'Crystalline Ether';

export type TemperatureClassType =
  | 'Absolute Zero'
  | 'Cryogenic'
  | 'Frigid'
  | 'Ambient'
  | 'Warm'
  | 'Incandescent'
  | 'Stellar Core'
  | 'Planck Flame';

export type MassClassType =
  | 'Negative Mass'
  | 'Ultralight'
  | 'Light'
  | 'Medium'
  | 'Dense'
  | 'Superdense'
  | 'Singularity';

export type ConductivityType =
  | 'Insulator'
  | 'Semiconductor'
  | 'Conductor'
  | 'Superconductor'
  | 'Quantum Hall'
  | 'Dielectric';

export type MagnetismType =
  | 'Diamagnetic'
  | 'Paramagnetic'
  | 'Ferromagnetic'
  | 'Superdiamagnetic'
  | 'Magnetar Grade'
  | 'Zero Flux';

export type CosmicTierType =
  | 'Primordial'
  | 'Terrestrial'
  | 'Alchemical'
  | 'Industrial'
  | 'Biogenic'
  | 'Arcane'
  | 'Stellar'
  | 'Transcendent';

export type ElementalAspectType =
  | 'Hydro'
  | 'Pyro'
  | 'Aero'
  | 'Geo'
  | 'Electro'
  | 'Cryo'
  | 'Bio'
  | 'Chrono'
  | 'Cosmo'
  | 'Aether'
  | 'Void';

export interface ElementPhysicalData {
  stateOfMatter: StateOfMatterType;
  temperatureClass: TemperatureClassType;
  thermalReading: string;
  density: string;
  massClass: MassClassType;
  mohsHardness: number;
  mohsBenchmark: string;
  conductivity: ConductivityType;
  magnetism: MagnetismType;
  luminescence: string;
  spectralBand: string;
  cosmicTier: CosmicTierType;
  elementalAspect: ElementalAspectType;
  stability: string;
  resonanceHz: string;
  entropyScore: number; // 0 - 100
  alchemicalFormula: string;
  shinyAnomalies?: string[];
  shinyTitle?: string;
}

/** Deterministic pseudo-random string hasher */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** PRNG with seed */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Procedurally generates comprehensive physical properties and telemetry for any element.
 * Deterministic for the same name and shiny flag.
 */
export function generatePhysicalData(
  name: string,
  emoji: string,
  isShiny: boolean = false
): ElementPhysicalData {
  const norm = name.trim().toLowerCase();
  const seed = hashString(norm + (isShiny ? '::shiny::variant' : '::standard'));
  const rand = seededRandom(seed);

  // Semantic keyword heuristics
  const isWater = /water|sea|ocean|rain|wave|lake|river|swamp|puddle|tea|coffee|juice|soup|blood|liquor|wine|beer|oil|liquid|fluid/i.test(norm);
  const isFire = /fire|flame|lava|magma|volcano|sun|star|plasma|burn|heat|ember|inferno|combustion|blaze|explosion/i.test(norm);
  const isWind = /wind|air|storm|tornado|cloud|smoke|dust|breath|breeze|blizzard|sky|vapor|steam|gas|atmosphere/i.test(norm);
  const isEarth = /earth|stone|rock|mountain|soil|mud|clay|sand|desert|continent|island|metal|iron|gold|silver|diamond|ore|plate/i.test(norm);
  const isIce = /ice|cold|frost|freeze|glacier|snow|freezer|frozen|cryo/i.test(norm);
  const isElectro = /lightning|thunder|electricity|battery|energy|laser|power|shock|spark|computer|robot|cyber|electronic/i.test(norm);
  const isLife = /life|human|man|woman|child|dog|cat|bird|fish|plant|tree|flower|dinosaur|dragon|monster|creature|pokemon|zombie|bacteria|alien/i.test(norm);
  const isCosmo = /universe|galaxy|solar system|black hole|supernova|nebula|space|alien|cosmic|infinity|god|dimension|void|time|eternity|quantum/i.test(norm);
  const isTech = /engine|train|car|airplane|boat|ship|phone|internet|google|apple|microsoft|rocket|station|ai|cyborg|clock|hourglass/i.test(norm);

  // 1. Aspect
  let aspect: ElementalAspectType = 'Geo';
  if (isCosmo) aspect = 'Cosmo';
  else if (isElectro) aspect = 'Electro';
  else if (isIce) aspect = 'Cryo';
  else if (isFire) aspect = 'Pyro';
  else if (isWater) aspect = 'Hydro';
  else if (isWind) aspect = 'Aero';
  else if (isLife) aspect = 'Bio';
  else if (isTech) aspect = 'Electro';
  else if (isEarth) aspect = 'Geo';
  else {
    const aspects: ElementalAspectType[] = ['Geo', 'Hydro', 'Aero', 'Pyro', 'Bio', 'Aether'];
    aspect = aspects[Math.floor(rand() * aspects.length)];
  }

  // 2. Cosmic Tier
  let tier: CosmicTierType = 'Terrestrial';
  if (['water', 'fire', 'wind', 'earth'].includes(norm)) {
    tier = 'Primordial';
  } else if (isCosmo || /god|infinity|eternity|dimension|black hole/i.test(norm)) {
    tier = 'Transcendent';
  } else if (/star|galaxy|supernova|solar|nebula|sun/i.test(norm)) {
    tier = 'Stellar';
  } else if (/dragon|phoenix|magic|wizard|potion|alchem|unicorn/i.test(norm)) {
    tier = 'Arcane';
  } else if (isTech || /engine|battery|computer|robot|cyborg/i.test(norm)) {
    tier = 'Industrial';
  } else if (isLife) {
    tier = 'Biogenic';
  } else if (isWater || isEarth || isWind) {
    tier = 'Terrestrial';
  } else {
    tier = 'Alchemical';
  }

  // 3. State of Matter
  let state: StateOfMatterType = 'Solid';
  if (isFire || /sun|star|plasma|lightning|laser/i.test(norm)) {
    state = 'Plasma';
  } else if (isWater || /steam|tea|coffee|juice|soup|lake|ocean|rain|blood|potion/i.test(norm)) {
    state = isShiny ? 'Supercritical Fluid' : 'Liquid';
  } else if (isWind || /smoke|dust|gas|air|cloud|vapor|breath/i.test(norm)) {
    state = 'Gas';
  } else if (isCosmo || /black hole|quantum|singularity/i.test(norm)) {
    state = isShiny ? 'Tachyonic Energy' : 'Degenerate Matter';
  } else if (isShiny && rand() > 0.5) {
    state = 'Crystalline Ether';
  } else {
    state = 'Solid';
  }

  // 4. Temperature Class & Thermal Reading
  let tempClass: TemperatureClassType = 'Ambient';
  let thermalReading = '21 °C (294 K)';
  if (isIce) {
    tempClass = rand() > 0.5 ? 'Cryogenic' : 'Frigid';
    thermalReading = tempClass === 'Cryogenic' ? '-196.2 °C (76.9 K)' : '-18.0 °C (255.1 K)';
  } else if (isFire || /sun|star|lava|plasma|magma/i.test(norm)) {
    if (/sun|star|supernova/i.test(norm)) {
      tempClass = 'Stellar Core';
      thermalReading = '15,000,000 K (1.5×10⁷ °C)';
    } else {
      tempClass = 'Incandescent';
      thermalReading = '1,150 °C (1,423 K)';
    }
  } else if (/universe|black hole|big bang/i.test(norm)) {
    tempClass = isShiny ? 'Planck Flame' : 'Absolute Zero';
    thermalReading = isShiny ? '1.41×10³² K (Planck)' : '2.725 K (CMB)';
  } else if (isWater || isLife) {
    tempClass = isLife ? 'Warm' : 'Ambient';
    thermalReading = isLife ? '37.0 °C (310.1 K)' : '18.5 °C (291.6 K)';
  } else {
    tempClass = 'Ambient';
    thermalReading = `${Math.round(15 + rand() * 18)} °C (${Math.round(288 + rand() * 18)} K)`;
  }

  // 5. Density & Mass Class
  let density = '1.00 g/cm³';
  let massClass: MassClassType = 'Medium';
  if (state === 'Gas') {
    density = `${(0.0011 + rand() * 0.001).toFixed(4)} g/cm³`;
    massClass = 'Ultralight';
  } else if (state === 'Liquid') {
    density = `${(0.92 + rand() * 0.35).toFixed(2)} g/cm³`;
    massClass = 'Medium';
  } else if (isEarth || /iron|gold|metal|diamond|stone/i.test(norm)) {
    if (/gold|platinum/i.test(norm)) {
      density = '19.32 g/cm³';
      massClass = 'Superdense';
    } else {
      density = `${(2.6 + rand() * 5.2).toFixed(2)} g/cm³`;
      massClass = 'Dense';
    }
  } else if (/black hole|singularity|neutron/i.test(norm)) {
    density = '4.0×10¹⁴ g/cm³';
    massClass = 'Singularity';
  } else {
    density = `${(1.1 + rand() * 1.8).toFixed(2)} g/cm³`;
    massClass = 'Medium';
  }

  if (isShiny && rand() > 0.6) {
    massClass = 'Singularity';
  }

  // 6. Mohs Hardness Scale
  let mohsHardness = 1.0;
  let mohsBenchmark = 'Talc (1.0)';
  if (state === 'Gas' || state === 'Liquid') {
    mohsHardness = 0.0;
    mohsBenchmark = 'Fluid (0.0)';
  } else if (/diamond/i.test(norm)) {
    mohsHardness = isShiny ? 11.5 : 10.0;
    mohsBenchmark = isShiny ? 'Hyper-Diamond (11.5)' : 'Diamond (10.0)';
  } else if (/iron|metal|steel|sword|robot/i.test(norm)) {
    mohsHardness = 6.5;
    mohsBenchmark = 'Hardened Steel (6.5)';
  } else if (/stone|rock|mountain/i.test(norm)) {
    mohsHardness = 7.0;
    mohsBenchmark = 'Quartz (7.0)';
  } else if (/gold|silver|copper/i.test(norm)) {
    mohsHardness = 2.8;
    mohsBenchmark = 'Calcite (3.0)';
  } else {
    mohsHardness = parseFloat((1.5 + rand() * 5).toFixed(1));
    mohsBenchmark = `Apatite Scale (${mohsHardness})`;
  }

  // 7. Electrical Conductivity
  let conductivity: ConductivityType = 'Insulator';
  if (isShiny) {
    conductivity = 'Superconductor';
  } else if (/lightning|battery|energy|power/i.test(norm)) {
    conductivity = 'Superconductor';
  } else if (/metal|iron|gold|silver|copper|robot|computer/i.test(norm)) {
    conductivity = 'Conductor';
  } else if (/silicon|glass|sand|semiconductor/i.test(norm)) {
    conductivity = 'Semiconductor';
  } else if (/water/i.test(norm)) {
    conductivity = 'Conductor';
  } else {
    conductivity = 'Insulator';
  }

  // 8. Magnetism
  let magnetism: MagnetismType = 'Diamagnetic';
  if (isShiny) {
    magnetism = rand() > 0.4 ? 'Magnetar Grade' : 'Superdiamagnetic';
  } else if (/iron|metal|steel|magnet/i.test(norm)) {
    magnetism = 'Ferromagnetic';
  } else if (/water|organic|wood|glass/i.test(norm)) {
    magnetism = 'Diamagnetic';
  } else if (/black hole|star|sun/i.test(norm)) {
    magnetism = 'Magnetar Grade';
  } else {
    magnetism = 'Paramagnetic';
  }

  // 9. Luminescence & Spectral Band
  let luminescence = 'Non-Emissive';
  let spectralBand = '550 nm (Neutral Amber)';
  if (isShiny) {
    luminescence = 'Prismatic Cherenkov Flash';
    spectralBand = 'Full-Spectrum Holographic (380 - 750 nm)';
  } else if (isFire || /sun|star|laser/i.test(norm)) {
    luminescence = 'Radiant Photon Burst';
    spectralBand = '650 nm (Stellar Crimson/Gold)';
  } else if (/lightning|neon|plasma/i.test(norm)) {
    luminescence = 'High-Intensity Discharge';
    spectralBand = '420 nm (Electric Violet)';
  } else if (/ghost|potion|radioactive|magic/i.test(norm)) {
    luminescence = 'Bioluminescent';
    spectralBand = '515 nm (Emerald Phosphor)';
  }

  // 10. Stability & Entropy
  const stability = isShiny
    ? 'Eternal (Chrono-Anchored)'
    : isCosmo
    ? '14.2 Billion Years'
    : isLife
    ? 'Dynamic Homeostasis'
    : 'Stable (Terrestrial)';

  const resonanceHz = isShiny
    ? '864 Hz (Sacred Golden Ratio)'
    : isElectro
    ? '1.420 GHz (Hydrogen Line)'
    : isCosmo
    ? '432 Hz (Universal Tone)'
    : `${Math.round(120 + rand() * 800)} Hz`;

  const entropyScore = isShiny ? 0 : Math.round(rand() * 85 + 10);

  // 11. Alchemical Registry Formula
  const cleanInitials = norm.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase();
  const hexNum = (seed % 9000 + 1000).toString(16).toUpperCase();
  const alchemicalFormula =
    norm === 'water' ? 'H₂O' :
    norm === 'fire' ? 'γ-Plasma' :
    norm === 'earth' ? 'SiO₂·Fe' :
    norm === 'wind' ? 'N₂·O₂·Ar' :
    norm === 'steam' ? 'H₂O (vap)' :
    norm === 'lava' ? 'SiO₂·(Fe,Mg)₂SiO₄' :
    `${cleanInitials}-#${hexNum}`;

  // 12. Shiny Anomalous Characteristics (Pokémon-style rare attributes)
  const shinyAnomalies = isShiny
    ? [
        'Zero-resistance supercurrent conductivity at room temperature',
        'Negative refractive index producing iridescent rainbow diffraction',
        'Quantum entanglement lattice immune to physical degradation',
        'Luminescent emission without thermal energy dissipation',
      ]
    : undefined;

  const shinyTitles = [
    '✨ Prismatic Sovereign',
    '✨ Iridescent Quantum Form',
    '✨ Radiant Celestial Anomaly',
    '✨ Astral Shimmer Variant',
    '✨ Luminescent Singularity',
  ];
  const shinyTitle = isShiny ? shinyTitles[Math.floor(rand() * shinyTitles.length)] : undefined;

  return {
    stateOfMatter: state,
    temperatureClass: tempClass,
    thermalReading,
    density,
    massClass,
    mohsHardness,
    mohsBenchmark,
    conductivity,
    magnetism,
    luminescence,
    spectralBand,
    cosmicTier: tier,
    elementalAspect: aspect,
    stability,
    resonanceHz,
    entropyScore,
    alchemicalFormula,
    shinyAnomalies,
    shinyTitle,
  };
}

/**
 * Roll for Shiny chance when synthesizing an element (Pokémon style).
 * Odds: 1 in 512 (~0.195%) matching classic Pokémon Masuda method / Shiny Charm odds.
 */
export function rollIsShiny(name: string, _recipeA?: string, _recipeB?: string): boolean {
  // 1 in 512 chance
  const roll = Math.floor(Math.random() * 512);
  return roll === 0;
}

/**
 * Returns custom holographic styling properties for Shiny variants
 */
export function getShinyFoilStyle(name: string) {
  const seed = hashString(name.toLowerCase());
  const palettes = [
    {
      name: 'Prismatic Starlight',
      borderGlow: 'from-amber-400 via-pink-500 to-cyan-400',
      badgeBg: 'bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400',
      textGlow: 'text-amber-200',
      sparkleColor: '#fef08a',
    },
    {
      name: 'Solar Cobalt',
      borderGlow: 'from-blue-400 via-indigo-500 to-emerald-400',
      badgeBg: 'bg-gradient-to-r from-blue-500 via-indigo-600 to-emerald-400',
      textGlow: 'text-cyan-200',
      sparkleColor: '#38bdf8',
    },
    {
      name: 'Aether Emerald',
      borderGlow: 'from-emerald-400 via-teal-400 to-lime-300',
      badgeBg: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-400',
      textGlow: 'text-emerald-200',
      sparkleColor: '#4ade80',
    },
    {
      name: 'Amethyst Void',
      borderGlow: 'from-purple-400 via-fuchsia-500 to-pink-400',
      badgeBg: 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500',
      textGlow: 'text-fuchsia-200',
      sparkleColor: '#e879f9',
    },
  ];

  return palettes[seed % palettes.length];
}
