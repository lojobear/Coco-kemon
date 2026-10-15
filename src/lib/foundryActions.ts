import type { Process } from '../types';

/**
 * Foundry actions: 50 destructive / transformative operations for the third
 * slot of a combine. These are the furnace-floor verbs — crush, melt, burn,
 * shatter — things you DO to matter in a foundry. All unlocked by default so
 * they are immediately usable in the process picker.
 */
export const FOUNDRY_ACTIONS: Process[] = [
  // ---- Thermal: the furnace floor ----
  { id: 'MELT', name: 'Melt', verb: 'reduces to a flowing molten liquid', description: 'Turns solids into glowing rivers of liquid matter.', category: 'Thermal', symbol: '🫠', unlocked: true },
  { id: 'BURN', name: 'Burn', verb: 'engulfs in open flame until combusted', description: 'Sets matter alight, leaving char, smoke and heat-warped remains.', category: 'Thermal', symbol: '🔥', unlocked: true },
  { id: 'SCORCH', name: 'Scorch', verb: 'sears and blackens exposed surfaces with radiant heat', description: 'Blasts the outside with searing radiant heat while the core survives.', category: 'Thermal', symbol: '🌋', unlocked: true },
  { id: 'SMELT', name: 'Smelt', verb: 'separates pure material from dross in furnace heat', description: 'Refines raw matter in the furnace, drawing the pure essence from the slag.', category: 'Thermal', symbol: '🏭', unlocked: true },
  { id: 'FORGE', name: 'Forge', verb: 'shapes glowing-hot matter with hammer and anvil', description: 'Beats white-hot material into deliberate, hardened forms.', category: 'Thermal', symbol: '⚒️', unlocked: true },
  { id: 'INCINERATE', name: 'Incinerate', verb: 'reduces entirely to ash, ember and heat-shimmer', description: 'Obliterates matter in total combustion, leaving only drifting ash.', category: 'Thermal', symbol: '♨️', unlocked: true },
  { id: 'CHAR', name: 'Char', verb: 'blackens into brittle carbon without full combustion', description: 'Slow-burns the surface into cracked black carbon.', category: 'Thermal', symbol: '⬛', unlocked: true },
  { id: 'BRAZE', name: 'Braze', verb: 'joins pieces with a molten filler-metal bond', description: 'Fuses separate parts with a glowing seam of molten filler.', category: 'Thermal', symbol: '🥉', unlocked: true },
  { id: 'WELD', name: 'Weld', verb: 'fuses separate masses into one continuous solid with heat', description: 'Melts the boundary between pieces until they are one solid.', category: 'Thermal', symbol: '🔗', unlocked: true },
  { id: 'ROAST', name: 'Roast', verb: 'slow-cooks with dry circulating heat until transformed', description: 'Bathes matter in dry, even heat until it transforms through and through.', category: 'Thermal', symbol: '🍖', unlocked: true },
  { id: 'TORCH', name: 'Torch', verb: 'cuts or scars with a focused jet of extreme heat', description: 'Slices with a needle of blue-white flame.', category: 'Thermal', symbol: '🔦', unlocked: true },

  // ---- Mechanical: the breaking bench ----
  { id: 'SHATTER', name: 'Shatter', verb: 'violently breaks into sharp flying shards', description: 'Explodes brittle structure into glittering fragments.', category: 'Mechanical', symbol: '💥', unlocked: true },
  { id: 'SMASH', name: 'Smash', verb: 'flattens with a single brutal blunt impact', description: 'One decisive blow; whatever it was, now it is flat.', category: 'Mechanical', symbol: '🔨', unlocked: true },
  { id: 'DEMOLISH', name: 'Demolish', verb: 'wrecks structural integrity into rubble', description: 'Tears down every load-bearing structure into chaotic rubble.', category: 'Mechanical', symbol: '🧱', unlocked: true },
  { id: 'CRACK', name: 'Crack', verb: 'splits with deep fissures while barely holding together', description: 'Stresses matter until it fractures but refuses to fall apart.', category: 'Mechanical', symbol: '🪞', unlocked: true },
  { id: 'SPLINTER', name: 'Splinter', verb: 'breaks into sharp slivers along the grain', description: 'Splits fibrous or layered matter into needle-sharp slivers.', category: 'Mechanical', symbol: '🪵', unlocked: true },
  { id: 'RUPTURE', name: 'Rupture', verb: 'bursts apart from overwhelming internal pressure', description: 'Overfills from within until the skin gives way all at once.', category: 'Mechanical', symbol: '🫧', unlocked: true },
  { id: 'SHRED', name: 'Shred', verb: 'tears into thin ribbons and strips', description: 'Rends matter into fluttering ribbons.', category: 'Mechanical', symbol: '🥓', unlocked: true },
  { id: 'TEAR', name: 'Tear', verb: 'rips into ragged pieces by brute force', description: 'Pulls apart with raw strength, leaving ragged edges.', category: 'Mechanical', symbol: '💪', unlocked: true },
  { id: 'GRATE', name: 'Grate', verb: 'scrapes into coarse shreds and pulp', description: 'Reduces matter against a rasping surface into shreds.', category: 'Mechanical', symbol: '🧀', unlocked: true },
  { id: 'CRUMBLE', name: 'Crumble', verb: 'breaks down into soft crumbs and grains', description: 'Collapses into soft, powdery crumbs at a touch.', category: 'Mechanical', symbol: '🍪', unlocked: true },
  { id: 'SNAP', name: 'Snap', verb: 'breaks cleanly at a single stress point', description: 'Finds the weak point and breaks it in one clean motion.', category: 'Mechanical', symbol: '🥢', unlocked: true },
  { id: 'DENT', name: 'Dent', verb: 'caves surfaces inward with blunt deformation', description: 'Hammers the surface into concave scars without breaking through.', category: 'Mechanical', symbol: '🛎️', unlocked: true },
  { id: 'PIERCE', name: 'Pierce', verb: 'drives pointed force clean through', description: 'Punches a decisive hole straight through the whole mass.', category: 'Mechanical', symbol: '🗡️', unlocked: true },

  // ---- Pressure: containment failure ----
  { id: 'IMPLODE', name: 'Implode', verb: 'collapses violently inward under vacuum force', description: 'Crushes from all sides at once as the void rushes in.', category: 'Pressure', symbol: '🕳️', unlocked: true },
  { id: 'DETONATE', name: 'Detonate', verb: 'triggers a rapid outward explosion', description: 'Converts everything into a fireball and a shockwave.', category: 'Pressure', symbol: '🧨', unlocked: true },
  { id: 'OVERPRESSURIZE', name: 'Overpressurize', verb: 'forces matter past its structural pressure limit', description: 'Pumps pressure past the breaking point and watches what gives.', category: 'Pressure', symbol: '🎈', unlocked: true },
  { id: 'BURST', name: 'Burst', verb: 'releases containment in a sudden violent pop', description: 'Pops like an overfilled vessel, spraying contents everywhere.', category: 'Pressure', symbol: '💨', unlocked: true },

  // ---- Alchemical: corrosion and transmutation ----
  { id: 'CORRODE', name: 'Corrode', verb: 'eats away surfaces with aggressive acid', description: 'Dissolves the proud surfaces into pitted, eaten-away ruin.', category: 'Alchemical', symbol: '🧪', unlocked: true },
  { id: 'RUST', name: 'Rust', verb: 'oxidizes iron-bearing matter into flaking decay', description: 'Blooms orange-brown decay across every metal surface.', category: 'Alchemical', symbol: '🟠', unlocked: true },
  { id: 'PETRIFY', name: 'Petrify', verb: 'transmutes living tissue into solid stone', description: 'Turns flesh, leaf and limb into cold unyielding rock.', category: 'Alchemical', symbol: '🗿', unlocked: true },
  { id: 'VITRIFY', name: 'Vitrify', verb: 'fuses into a smooth glassy solid', description: 'Melts the surface into flawless, transparent glass.', category: 'Alchemical', symbol: '🪟', unlocked: true },
  { id: 'MUMMIFY', name: 'Mummify', verb: 'desiccates and preserves against all decay', description: 'Wraps in dry preservation, halting rot forever.', category: 'Alchemical', symbol: '🏺', unlocked: true },
  { id: 'CALCIFY', name: 'Calcify', verb: 'hardens by depositing a mineral crust over', description: 'Encases in a stony shell of built-up minerals.', category: 'Alchemical', symbol: '🦴', unlocked: true },
  { id: 'GALVANIZE', name: 'Galvanize', verb: 'seals in a protective zinc shell', description: 'Coats in bright armor against rust and ruin.', category: 'Alchemical', symbol: '🛡️', unlocked: true },
  { id: 'ANODIZE', name: 'Anodize', verb: 'hardens a metallic skin with an oxide layer', description: 'Grows a tough, colorful oxide skin over bare metal.', category: 'Alchemical', symbol: '🔩', unlocked: true },
  { id: 'VULCANIZE', name: 'Vulcanize', verb: 'heat-cures into a tough elastic form', description: 'Bakes soft matter into springy, indestructible rubber.', category: 'Alchemical', symbol: '🌡️', unlocked: true },
  { id: 'FUME', name: 'Fume', verb: 'exposes to reactive vapor that transforms surfaces', description: 'Hangs matter in choking vapor until the surface surrenders.', category: 'Alchemical', symbol: '🌫️', unlocked: true },
  { id: 'TAR', name: 'Tar', verb: 'drowns in thick black viscous pitch', description: 'Submerges in boiling black pitch; nothing escapes unchanged.', category: 'Alchemical', symbol: '🛢️', unlocked: true },
  { id: 'PICKLE', name: 'Pickle', verb: 'preserves sharply in corrosive brine', description: 'Steeps in biting brine until transformed and eternal.', category: 'Alchemical', symbol: '🥒', unlocked: true },

  // ---- Electromagnetic: energetic violence ----
  { id: 'ZAP', name: 'Zap', verb: 'strikes with a sudden high-voltage jolt', description: 'One crackling bolt; matter never sits the same afterward.', category: 'Electromagnetic', symbol: '⚡', unlocked: true },
  { id: 'SURGE', name: 'Surge', verb: 'floods with a rising tide of current', description: 'Drowns circuits in climbing current until something arcs.', category: 'Electromagnetic', symbol: '🌊', unlocked: true },
  { id: 'OVERLOAD', name: 'Overload', verb: 'pushes past safe capacity until spectacular failure', description: 'Redlines every system until the whole thing blows.', category: 'Electromagnetic', symbol: '🔌', unlocked: true },
  { id: 'DEMAGNETIZE', name: 'Demagnetize', verb: 'scrambles aligned dipoles into neutrality', description: 'Wipes every trace of magnetism into confused static.', category: 'Electromagnetic', symbol: '🧲', unlocked: true },

  // ---- Biological: rot and ruin ----
  { id: 'WITHER', name: 'Wither', verb: 'drains vitality until brittle and dry', description: 'Sucks the life out until only husk remains.', category: 'Biological', symbol: '🍂', unlocked: true },
  { id: 'ROT', name: 'Rot', verb: 'accelerates putrefaction into soft mush', description: 'Fast-forwards decay into stinking, glorious mush.', category: 'Biological', symbol: '🍄', unlocked: true },
  { id: 'MOLT', name: 'Molt', verb: 'forces violent shedding of the outer layer', description: 'Rips away the old skin to reveal what waits beneath.', category: 'Biological', symbol: '🐍', unlocked: true },
  { id: 'DEVOUR', name: 'Devour', verb: 'consumes entirely, leaving nothing behind', description: 'Feeds the whole thing to something hungrier.', category: 'Biological', symbol: '🦷', unlocked: true },

  // ---- Temporal: entropy wins ----
  { id: 'DECAY', name: 'Decay', verb: 'fast-forwards natural breakdown and ruin', description: 'Lets entropy win, quickly and completely.', category: 'Temporal', symbol: '⏳', unlocked: true },
  { id: 'ERODE', name: 'Erode', verb: 'wears away with relentless abrasive flow', description: 'Grinds down over ages of wind, water and grit — in seconds.', category: 'Temporal', symbol: '🏖️', unlocked: true },
];
