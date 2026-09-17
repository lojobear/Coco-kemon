import type { Process } from '../types';

/**
 * Additional Foundry transformations. These are intentionally varied so the
 * process picker offers genuinely different physical, biological, chemical,
 * electromagnetic, temporal and speculative crafting routes.
 */
export const EXTRA_PROCESSES: Process[] = [
  { id: 'BOIL', name: 'Boil', verb: 'drives a liquid into vigorous vaporization', description: 'Pushes volatile matter through its boiling point to separate vapor, foam and concentrated residue.', category: 'Thermal', symbol: '♨️', unlocked: true },
  { id: 'SUBLIMATE', name: 'Sublimate', verb: 'converts a solid directly into vapor', description: 'Skips the liquid phase to reveal volatile crystals, vapors and purified deposits.', category: 'Thermal', symbol: '💨', unlocked: true },
  { id: 'ANNEAL', name: 'Anneal', verb: 'heats and slowly relaxes internal stress in', description: 'Reorders strained structure through controlled heat and gradual cooling.', category: 'Thermal', symbol: '🛠️', unlocked: true },
  { id: 'QUENCH', name: 'Quench', verb: 'rapidly cools from a high-energy state', description: 'Locks hot matter into hard, glassy or metastable forms with an abrupt thermal drop.', category: 'Thermal', symbol: '🧊', unlocked: true },
  { id: 'SINTER', name: 'Sinter', verb: 'fuses particles below their full melting point', description: 'Bonds powdered or granular matter into a dense coherent solid.', category: 'Thermal', symbol: '🧱', unlocked: true },
  { id: 'CALCINE', name: 'Calcine', verb: 'heats strongly to drive off bound volatiles', description: 'Decomposes hydrates and carbonates into dry mineral oxides and ash-like forms.', category: 'Thermal', symbol: '🌋', unlocked: true },
  { id: 'PASTEURIZE', name: 'Pasteurize', verb: 'gently heat-treats to suppress microbes in', description: 'Uses controlled heat to stabilize biological mixtures without fully sterilizing them.', category: 'Thermal', symbol: '🥛', unlocked: true },
  { id: 'CRYOSHOCK', name: 'Cryoshock', verb: 'subjects to an abrupt extreme cold pulse', description: 'Creates brittle, fractured or preserved cryogenic states through thermal shock.', category: 'Thermal', symbol: '🥶', unlocked: true },
  { id: 'TEMPER', name: 'Temper', verb: 'cycles heat to balance hardness and resilience in', description: 'Tunes material toughness by controlled reheating after hardening.', category: 'Thermal', symbol: '⚒️', unlocked: true },

  { id: 'GRIND', name: 'Grind', verb: 'abrades into smaller particles', description: 'Reduces matter into grit, meal, pigment or powder through repeated friction.', category: 'Mechanical', symbol: '⚙️', unlocked: true },
  { id: 'MILL', name: 'Mill', verb: 'machines into precise surfaces and channels', description: 'Cuts away material with controlled tooling to reveal engineered forms.', category: 'Mechanical', symbol: '🏭', unlocked: true },
  { id: 'EXTRUDE', name: 'Extrude', verb: 'forces through a shaped die', description: 'Transforms pliable material into continuous rods, filaments, tubes or profiles.', category: 'Mechanical', symbol: '➰', unlocked: true },
  { id: 'ROLL', name: 'Roll', verb: 'compresses between rotating surfaces', description: 'Flattens or elongates matter into sheets, ribbons or layered laminates.', category: 'Mechanical', symbol: '🧻', unlocked: true },
  { id: 'HAMMER', name: 'Hammer', verb: 'repeatedly impacts and forges', description: 'Shapes tough solids through concentrated impact, deformation and work hardening.', category: 'Mechanical', symbol: '🔨', unlocked: true },
  { id: 'SHEAR', name: 'Shear', verb: 'slides adjacent layers past one another', description: 'Slices or deforms matter through opposing lateral forces.', category: 'Mechanical', symbol: '✂️', unlocked: true },
  { id: 'STRETCH', name: 'Stretch', verb: 'draws into a longer thinner form', description: 'Tests and transforms elastic, fibrous or ductile materials under tension.', category: 'Mechanical', symbol: '↔️', unlocked: true },
  { id: 'TWIST', name: 'Twist', verb: 'winds fibers or structures around an axis', description: 'Introduces torsion to create cords, springs, helices and stressed forms.', category: 'Mechanical', symbol: '🧬', unlocked: true },
  { id: 'WEAVE', name: 'Weave', verb: 'interlaces flexible strands and layers', description: 'Builds textiles, meshes and composite lattices from elongated matter.', category: 'Mechanical', symbol: '🧶', unlocked: true },
  { id: 'FRAGMENT', name: 'Fragment', verb: 'breaks into distinct pieces without pulverizing', description: 'Splits larger structures into shards, chunks or modular subcomponents.', category: 'Mechanical', symbol: '💥', unlocked: true },

  { id: 'OXIDIZE', name: 'Oxidize', verb: 'removes electrons through an oxidizing reaction', description: 'Creates oxides, tarnish, rust-like surfaces and higher oxidation states.', category: 'Alchemical', symbol: '🟠', unlocked: true },
  { id: 'REDUCE', name: 'Reduce', verb: 'adds electrons or removes oxygen from', description: 'Reverses oxidation to reveal reduced metals, pigments and reactive states.', category: 'Alchemical', symbol: '🔻', unlocked: true },
  { id: 'NEUTRALIZE', name: 'Neutralize', verb: 'balances opposing acidic and basic character in', description: 'Drives reactive extremes toward salts, buffers and more stable mixtures.', category: 'Alchemical', symbol: '⚖️', unlocked: true },
  { id: 'CATALYZE', name: 'Catalyze', verb: 'accelerates a transformation pathway in', description: 'Lowers reaction barriers so otherwise slow combinations rapidly rearrange.', category: 'Alchemical', symbol: '🧪', unlocked: true },
  { id: 'HYDROLYZE', name: 'Hydrolyze', verb: 'cleaves bonds using water', description: 'Breaks polymers, esters or biological structures into smaller hydrated products.', category: 'Alchemical', symbol: '💧', unlocked: true },
  { id: 'POLYMERIZE', name: 'Polymerize', verb: 'links repeating units into long chains', description: 'Turns small reactive molecules into plastics, resins, gels or elastic networks.', category: 'Alchemical', symbol: '🔗', unlocked: true },
  { id: 'CRYSTALLIZE', name: 'Crystallize', verb: 'orders particles into a repeating lattice', description: 'Converts dissolved or disordered matter into faceted crystalline structures.', category: 'Alchemical', symbol: '💎', unlocked: true },
  { id: 'PRECIPITATE', name: 'Precipitate', verb: 'forces dissolved matter out of solution', description: 'Creates solids, flakes or crystals from formerly dissolved components.', category: 'Alchemical', symbol: '🌨️', unlocked: true },
  { id: 'EMULSIFY', name: 'Emulsify', verb: 'disperses incompatible liquids into one another', description: 'Creates stable droplets, creams and complex multiphase mixtures.', category: 'Alchemical', symbol: '🥣', unlocked: true },
  { id: 'INFUSE', name: 'Infuse', verb: 'draws soluble essence into a carrier', description: 'Transfers flavor, pigment, aroma or active compounds into another medium.', category: 'Alchemical', symbol: '🫖', unlocked: true },
  { id: 'EXTRACT', name: 'Extract', verb: 'pulls a selected component out of', description: 'Separates oils, pigments, essences or active compounds from bulk matter.', category: 'Alchemical', symbol: '🧴', unlocked: true },
  { id: 'LEACH', name: 'Leach', verb: 'washes soluble components out of', description: 'Uses a fluid to selectively remove salts, minerals or reactive compounds.', category: 'Alchemical', symbol: '🚿', unlocked: true },
  { id: 'PLATE', name: 'Plate', verb: 'deposits a thin functional coating onto', description: 'Adds a metallic or mineral surface layer for conductivity, protection or luster.', category: 'Alchemical', symbol: '🪙', unlocked: true },
  { id: 'ETCH', name: 'Etch', verb: 'selectively erodes a surface pattern into', description: 'Uses controlled chemical or energetic attack to carve fine channels and textures.', category: 'Alchemical', symbol: '🪡', unlocked: true },
  { id: 'DOPE', name: 'Dope', verb: 'introduces trace impurities to tune properties of', description: 'Adds tiny amounts of foreign atoms to alter conductivity, color or reactivity.', category: 'Alchemical', symbol: '🔹', unlocked: true },

  { id: 'STERILIZE', name: 'Sterilize', verb: 'eliminates viable microorganisms from', description: 'Resets biological contamination to create a clean substrate for later growth.', category: 'Biological', symbol: '🧼', unlocked: true },
  { id: 'CULTURE', name: 'Culture', verb: 'grows a selected living population within', description: 'Encourages microbes, cells or tissues to multiply in a controlled nutrient environment.', category: 'Biological', symbol: '🧫', unlocked: true },
  { id: 'GRAFT', name: 'Graft', verb: 'joins living structures so they heal together', description: 'Combines tissues, stems or biological surfaces into one integrated organism.', category: 'Biological', symbol: '🌿', unlocked: true },
  { id: 'SPLICE', name: 'Splice', verb: 'joins compatible biological or fibrous segments', description: 'Creates hybrid continuity by connecting cut strands, tissues or encoded sequences.', category: 'Biological', symbol: '🧬', unlocked: true },
  { id: 'MUTATE', name: 'Mutate', verb: 'introduces controlled heritable variation into', description: 'Pushes living or genetic material toward novel traits, forms and adaptations.', category: 'Biological', symbol: '☣️', unlocked: true },
  { id: 'HYBRIDIZE', name: 'Hybridize', verb: 'combines compatible lineages or functional traits', description: 'Merges biological characteristics into a new mixed lineage.', category: 'Biological', symbol: '🧬', unlocked: true },
  { id: 'DIGEST', name: 'Digest', verb: 'enzymatically breaks complex matter down', description: 'Converts biological or food-like material into simpler nutrient-rich components.', category: 'Biological', symbol: '🫀', unlocked: true },
  { id: 'PHOTOSYNTHESIZE', name: 'Photosynthesize', verb: 'uses light to build stored chemical energy in', description: 'Encourages photobiological growth, pigments and sugar-producing structures.', category: 'Biological', symbol: '🌞', unlocked: true },
  { id: 'COMPOST', name: 'Compost', verb: 'biologically decomposes into fertile substrate', description: 'Turns organic matter into dark nutrient-rich humus through microbial breakdown.', category: 'Biological', symbol: '🍂', unlocked: true },

  { id: 'IONIZE', name: 'Ionize', verb: 'strips or adds electrons to create charged particles', description: 'Pushes matter into electrically charged ionic or plasma-like states.', category: 'Electromagnetic', symbol: '⚡', unlocked: true },
  { id: 'IRRADIATE', name: 'Irradiate', verb: 'exposes to energetic radiation', description: 'Triggers photochemical, sterilizing, color-changing or structural radiation effects.', category: 'Electromagnetic', symbol: '☢️', unlocked: true },
  { id: 'POLARIZE', name: 'Polarize', verb: 'aligns internal charge or optical orientation in', description: 'Creates directional electrical, magnetic or light-sensitive behavior.', category: 'Electromagnetic', symbol: '🧭', unlocked: true },
  { id: 'ELECTROLYZE', name: 'Electrolyze', verb: 'uses current to drive chemical separation in', description: 'Splits compounds or deposits new substances using an electric potential.', category: 'Electromagnetic', symbol: '🔋', unlocked: true },
  { id: 'ARC', name: 'Arc', verb: 'strikes with a concentrated electrical arc', description: 'Locally melts, welds, ionizes or chars matter with intense electrical discharge.', category: 'Electromagnetic', symbol: '🌩️', unlocked: true },
  { id: 'PULSE', name: 'Pulse', verb: 'applies repeated bursts of energy to', description: 'Rhythmically excites responsive structures with short energetic impulses.', category: 'Electromagnetic', symbol: '📶', unlocked: true },

  { id: 'VACUUM', name: 'Vacuum', verb: 'removes surrounding gas and ambient pressure from', description: 'Encourages degassing, evaporation, expansion and void-adapted forms.', category: 'Pressure', symbol: '🕳️', unlocked: true },
  { id: 'PRESSURIZE', name: 'Pressurize', verb: 'raises surrounding pressure around', description: 'Compresses gases, dissolves volatiles and forces matter into dense high-pressure states.', category: 'Pressure', symbol: '🎈', unlocked: true },
  { id: 'DECOMPRESS', name: 'Decompress', verb: 'rapidly releases confining pressure from', description: 'Creates foams, bubbles, fractures and expanded structures through pressure loss.', category: 'Pressure', symbol: '💨', unlocked: true },
  { id: 'CENTRIFUGE', name: 'Centrifuge', verb: 'spins rapidly to separate by density', description: 'Sorts mixtures into heavy pellets, light fractions and layered phases.', category: 'Pressure', symbol: '🌀', unlocked: true },
  { id: 'AERATE', name: 'Aerate', verb: 'mixes fine gas bubbles throughout', description: 'Adds oxygen, foam, porosity or buoyancy to fluid and soft matter.', category: 'Pressure', symbol: '🫧', unlocked: true },

  { id: 'ACCELERATE', name: 'Accelerate', verb: 'pushes its natural transformation far forward in time', description: 'Rapidly advances curing, weathering, maturation or evolutionary-style change.', category: 'Temporal', symbol: '⏩', unlocked: true },
  { id: 'REVERSE', name: 'Reverse', verb: 'drives toward an earlier or opposite state', description: 'Explores reversible reactions, restored materials and conceptual inversions.', category: 'Temporal', symbol: '⏪', unlocked: true },
  { id: 'ECHO', name: 'Echo', verb: 'duplicates a structural motif through resonant repetition', description: 'Creates repeated patterns, copies, harmonics and recursively patterned forms.', category: 'Temporal', symbol: '🔁', unlocked: true },
  { id: 'PHASE_SHIFT', name: 'Phase Shift', verb: 'pushes matter into an unusual alternate phase', description: 'Explores exotic solid, liquid, gaseous, energetic and fictional phase transitions.', category: 'Alchemical', symbol: '🫥', unlocked: true },
  { id: 'RESONATE', name: 'Resonate', verb: 'drives at a characteristic vibration or frequency', description: 'Amplifies structural, acoustic or energetic modes until a new stable pattern emerges.', category: 'Electromagnetic', symbol: '🎵', unlocked: true },
];
