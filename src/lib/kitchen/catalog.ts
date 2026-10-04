/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Function Call Crafting Forge - Constants and Types
 */



// ============================================================================
// Types
// ============================================================================

export interface Ingredient {
  name: string;
  emoji: string;
  category?: string;
  tags?: string[];
}

export interface KitchenAction {
  name: string;           // Function name (alphanumeric + underscores)
  displayName: string;    // Human-readable name
  emoji: string;
  category?: string;
  tags?: string[];
}

export interface CombinationResult {
  result_name: string;
  emoji: string;
  rarity?: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  category?: string;
  color?: string;
  description?: string;
  tags?: string[];
}

export interface TimelineEntry {
  id: string;
  timestamp: Date;
  // Text from model response
  text?: string;
  // Action from function call
  action?: string;
  ingredients?: string[];
  result?: Ingredient | null;  // null when loading
}

export interface FinishedItem {
  id: string;
  name: string;
  emoji: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  category: string;
  color: string;
  description: string;
  toolsUsed: string[];
  ingredientsUsed: string[];
  ingredientHistory?: string[];
  processHistory?: string[];
  tags?: string[];
  createdAt: Date;
}

export const PRESET_IDEAS = [
  { name: 'Laser Sword', emoji: '⚔️', tag: 'Weapon' },
  { name: 'Potion of Invisibility', emoji: '🧪', tag: 'Alchemy' },
  { name: 'Cybernetic Watch', emoji: '⌚', tag: 'Tech' },
  { name: 'Tonkotsu Ramen', emoji: '🍜', tag: 'Gourmet' },
  { name: 'Space Shuttle', emoji: '🚀', tag: 'Engineering' },
  { name: 'Gourmet Truffle Pizza', emoji: '🍕', tag: 'Cooking' },
  { name: 'Phoenix Feather Wand', emoji: '🪄', tag: 'Magic' },
  { name: 'Quantum Core Reactor', emoji: '⚛️', tag: 'Sci-Fi' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/** Sanitize action name for function declarations: "deep fry" → "deep_fry", "3d print" → "_3d_print" */
export function sanitizeName(name: string): string {
  let sanitized = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }
  return sanitized;
}

/** Create KitchenAction from simple tool definition */
function createAction(name: string, emoji: string, category: string = 'general'): KitchenAction {
  return {
    name: sanitizeName(name),
    displayName: name,
    emoji,
    category,
  };
}

// ============================================================================
// 100 Comprehensive Crafting & Synthesis Tools
// ============================================================================

export const COOKING_ACTIONS: KitchenAction[] = [
  // Forging & Metallurgy
  createAction('smelt', '🔥', 'metallurgy'), createAction('forge', '🔨', 'metallurgy'),
  createAction('weld', '⚡', 'metallurgy'), createAction('temper', '🗡️', 'metallurgy'),
  createAction('cast', '🏺', 'metallurgy'), createAction('quench', '💧', 'metallurgy'),
  createAction('engrave', '✒️', 'metallurgy'), createAction('polish', '✨', 'metallurgy'),
  createAction('solder', '🔌', 'metallurgy'), createAction('rivet', '🔩', 'metallurgy'),

  // Alchemy & Chemistry
  createAction('mix', '🥣', 'alchemy'), createAction('distill', '🫙', 'alchemy'),
  createAction('crystallize', '💎', 'alchemy'), createAction('ferment', '🧪', 'alchemy'),
  createAction('infuse', '🍵', 'alchemy'), createAction('transmute', '🔮', 'alchemy'),
  createAction('dissolve', '🫠', 'alchemy'), createAction('sublime', '💨', 'alchemy'),
  createAction('filter', '🧹', 'alchemy'), createAction('brew', '🫖', 'alchemy'),
  createAction('steep', '🌿', 'alchemy'), createAction('react', '💥', 'alchemy'),
  createAction('synthesize', '🧬', 'alchemy'), createAction('condense', '🧊', 'alchemy'),

  // Electronics & Technology
  createAction('assemble', '🧩', 'tech'), createAction('wire', '🧶', 'tech'),
  createAction('charge', '🔋', 'tech'), createAction('program', '💻', 'tech'),
  createAction('calibrate', '🎯', 'tech'), createAction('laser_cut', '⚡', 'tech'),
  createAction('print_3d', '🟪', 'tech'), createAction('magnetize', '🧲', 'tech'),
  createAction('energize', '⚡', 'tech'), createAction('tune', '📻', 'tech'),
  createAction('compress', '🗜️', 'tech'), createAction('overclock', '🚀', 'tech'),

  // Cooking & Culinary Arts
  createAction('fry', '🍳', 'culinary'), createAction('boil', '🫧', 'culinary'),
  createAction('bake', '🥯', 'culinary'), createAction('roast', '🍗', 'culinary'),
  createAction('saute', '🥘', 'culinary'), createAction('grill', '🥩', 'culinary'),
  createAction('steam', '🥟', 'culinary'), createAction('simmer', '🍲', 'culinary'),
  createAction('chop', '🔪', 'culinary'), createAction('blend', '🌪️', 'culinary'),
  createAction('whisk', '🥄', 'culinary'), createAction('knead', '🍞', 'culinary'),
  createAction('season', '🧂', 'culinary'), createAction('caramelize', '🍯', 'culinary'),
  createAction('freeze', '🧊', 'culinary'), createAction('melt', '🫠', 'culinary'),
  createAction('smoke', '💨', 'culinary'), createAction('garnish', '🌿', 'culinary'),

  // Magic & Mysticism
  createAction('enchant', '✨', 'magic'), createAction('bind', '🕸️', 'magic'),
  createAction('empower', '🌟', 'magic'), createAction('summon', '📜', 'magic'),
  createAction('weave', '🧵', 'magic'), createAction('charm', '💖', 'magic'),
  createAction('channel', '🌌', 'magic'), createAction('inscribe', '🖋️', 'magic'),
  createAction('bless', '🕊️', 'magic'), createAction('purify', '💧', 'magic'),
  createAction('curse', '💀', 'magic'), createAction('alchemize', '⚗️', 'magic'),

  // Artisan Crafting
  createAction('carve', '🪵', 'crafting'), createAction('stitch', '🪡', 'crafting'),
  createAction('glue', '🧴', 'crafting'), createAction('sand', '📜', 'crafting'),
  createAction('varnish', '🖌️', 'crafting'), createAction('mold', '🧱', 'crafting'),
  createAction('cut', '✂️', 'crafting'), createAction('shape', '📐', 'crafting'),
  createAction('mount', '🖼️', 'crafting'), createAction('weave_cloth', '🧶', 'crafting'),
  createAction('laminate', '📄', 'crafting'), createAction('hammer', '🔨', 'crafting'),

  // Processing & Refinement
  createAction('grind', '⚙️', 'processing'), createAction('crush', '🔨', 'processing'),
  createAction('shred', '🧀', 'processing'), createAction('extract', '🧪', 'processing'),
  createAction('purify_metal', '✨', 'processing'), createAction('bleach', '⚪', 'processing'),
  createAction('calcine', '🔥', 'processing'), createAction('liquefy', '🌊', 'processing'),

  // Finishing & Output
  createAction('finish_item', '🎁', 'finishing'), createAction('serve', '🍽️', 'finishing'),
];

// ============================================================================
// Comprehensive Starting Inventory
// ============================================================================

export const STARTING_INGREDIENTS: Ingredient[] = [
  // Raw Metals & Minerals
  { name: 'iron ore', emoji: '🪨', category: 'Raw Material' },
  { name: 'copper wire', emoji: '🪢', category: 'Raw Material' },
  { name: 'gold dust', emoji: '✨', category: 'Raw Material' },
  { name: 'crystal gem', emoji: '💎', category: 'Raw Material' },
  { name: 'quartz', emoji: '🔮', category: 'Raw Material' },
  { name: 'silicon', emoji: '🧱', category: 'Raw Material' },
  { name: 'steel ingot', emoji: '🧱', category: 'Material' },
  { name: 'coal', emoji: '⬛', category: 'Raw Material' },

  // Elemental Essences & Magic
  { name: 'water', emoji: '💧', category: 'Element' },
  { name: 'fire essence', emoji: '🔥', category: 'Element' },
  { name: 'lightning orb', emoji: '⚡', category: 'Element' },
  { name: 'mana crystal', emoji: '🧪', category: 'Magic' },
  { name: 'dark matter', emoji: '🌌', category: 'Magic' },
  { name: 'starlight', emoji: '⭐', category: 'Magic' },
  { name: 'ice shard', emoji: '🧊', category: 'Element' },
  { name: 'phoenix feather', emoji: '🪶', category: 'Magic' },

  // Tech & Electronics
  { name: 'circuit board', emoji: '🟩', category: 'Tech' },
  { name: 'microchip', emoji: '🟫', category: 'Tech' },
  { name: 'battery', emoji: '🔋', category: 'Tech' },
  { name: 'plasma core', emoji: '⚛️', category: 'Tech' },
  { name: 'optical lens', emoji: '🔍', category: 'Tech' },
  { name: 'gear', emoji: '⚙️', category: 'Tech' },
  { name: 'magnet', emoji: '🧲', category: 'Tech' },
  { name: 'fiber cable', emoji: '🔌', category: 'Tech' },

  // Organic Materials
  { name: 'wood log', emoji: '🪵', category: 'Crafting' },
  { name: 'leather strip', emoji: '🟫', category: 'Crafting' },
  { name: 'cotton cloth', emoji: '🧵', category: 'Crafting' },
  { name: 'glass flask', emoji: '🧪', category: 'Crafting' },
  { name: 'rubber', emoji: '🛞', category: 'Crafting' },
  { name: 'clay', emoji: '🧱', category: 'Crafting' },

  // Culinary Staples
  { name: 'coffee beans', emoji: '🫘', category: 'Food' },
  { name: 'flour', emoji: '🌾', category: 'Food' },
  { name: 'eggs', emoji: '🥚', category: 'Food' },
  { name: 'milk', emoji: '🥛', category: 'Food' },
  { name: 'cheese', emoji: '🧀', category: 'Food' },
  { name: 'tomatoes', emoji: '🍅', category: 'Food' },
  { name: 'exotic spices', emoji: '🌶️', category: 'Food' },
  { name: 'cocoa bean', emoji: '🫘', category: 'Food' },
  { name: 'herb leaf', emoji: '🌿', category: 'Food' },
  { name: 'sugar', emoji: '🍯', category: 'Food' },
  { name: 'fresh ramen noodles', emoji: '🍜', category: 'Food' },
  { name: 'rich broth', emoji: '🍲', category: 'Food' },
];

export const PRESELECTED_INGREDIENTS = [];


