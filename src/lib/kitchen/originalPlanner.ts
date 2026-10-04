// Adapted from lojobear/Function-kitchen, lib/crafting-planner.ts.
/**
 * Deterministic local crafting planner.
 *
 * Plans are selected from the requested object's real construction domain,
 * not from a single generic fallback recipe. Every stage consumes either a
 * sourced raw material or a named output from an earlier stage.
 */

export interface PlannedCraftingStep {
  toolName: string;
  inputs: string[];
  outputName: string;
  outputEmoji: string;
  category: string;
  explanation: string;
}

export interface CraftingPlan {
  domain: string;
  sourceMaterials: string[];
  summary: string;
  finalDescription: string;
  steps: PlannedCraftingStep[];
}

type StepInput = Omit<PlannedCraftingStep, 'category'> & { category?: string };

const makeStep = (step: StepInput): PlannedCraftingStep => ({
  category: 'Component Sub-Assembly',
  ...step,
});

function cleanGoal(goal: string): string {
  return goal.trim().replace(/\s+/g, ' ') || 'Crafted Item';
}

function includesAny(value: string, words: string[]): boolean {
  return words.some(word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(value);
  });
}

function createCoffeePlan(goal: string, lower: string): CraftingPlan {
  const usesMilk = includesAny(lower, ['macchiato', 'latte', 'cappuccino', 'mocha', 'flat white']);
  const usesChocolate = lower.includes('mocha');
  const sourceMaterials = ['coffee beans', 'filtered water', 'clay'];
  if (usesMilk) sourceMaterials.push('milk');
  if (usesChocolate) sourceMaterials.push('cocoa bean');

  const steps = [
    makeStep({
      toolName: 'roast',
      inputs: ['coffee beans'],
      outputName: 'Fresh Roasted Coffee Beans',
      outputEmoji: '🫘',
      category: 'Food Ingredient',
      explanation: 'Roast the coffee beans first to develop the flavour needed for the drink.',
    }),
    makeStep({
      toolName: 'grind',
      inputs: ['Fresh Roasted Coffee Beans'],
      outputName: 'Fine Espresso Grounds',
      outputEmoji: '🤎',
      category: 'Food Ingredient',
      explanation: 'Grind the roasted beans finely enough for proper espresso extraction.',
    }),
    makeStep({
      toolName: 'mold',
      inputs: ['clay'],
      outputName: 'Fired Ceramic Cup',
      outputEmoji: '☕',
      category: 'Serving Vessel',
      explanation: 'Shape and fire a ceramic cup so the finished drink has a sensible vessel.',
    }),
    makeStep({
      toolName: 'brew',
      inputs: ['Fine Espresso Grounds', 'filtered water'],
      outputName: 'Fresh Espresso Shot',
      outputEmoji: '☕',
      category: 'Beverage Component',
      explanation: 'Extract the prepared grounds with hot filtered water into a concentrated espresso shot.',
    }),
  ];

  if (usesMilk) {
    steps.push(makeStep({
      toolName: 'whisk',
      inputs: usesChocolate ? ['milk', 'cocoa bean'] : ['milk'],
      outputName: usesChocolate ? 'Cocoa Milk Microfoam' : 'Silky Milk Microfoam',
      outputEmoji: '🥛',
      category: 'Beverage Component',
      explanation: usesChocolate
        ? 'Steam the milk with cocoa into a fine foam suited to a mocha.'
        : 'Steam and aerate the milk into fine microfoam suited to the requested coffee.',
    }));
  }

  steps.push(makeStep({
    toolName: 'garnish',
    inputs: [
      'Fresh Espresso Shot',
      ...(usesMilk ? [usesChocolate ? 'Cocoa Milk Microfoam' : 'Silky Milk Microfoam'] : []),
      'Fired Ceramic Cup',
    ],
    outputName: goal,
    outputEmoji: '☕',
    category: 'Finished Creation',
    explanation: `Combine only the prepared drink components and present the finished ${goal}.`,
  }));

  return {
    domain: 'Coffee craft',
    sourceMaterials,
    summary: `Plan: prepare the beans, extract the drink, make its vessel, then assemble the ${goal}.`,
    finalDescription: `${goal} made from freshly roasted beans and logically prepared beverage components.`,
    steps,
  };
}

function createTeaOrDrinkPlan(goal: string, lower: string): CraftingPlan {
  const isTea = includesAny(lower, ['tea', 'matcha', 'chai']);
  const isJuice = includesAny(lower, ['juice', 'smoothie', 'lemonade']);

  if (isTea) {
    return {
      domain: 'Tea craft',
      sourceMaterials: ['tea leaves', 'filtered water', 'clay', ...(lower.includes('chai') ? ['milk', 'exotic spices'] : [])],
      summary: `Plan: prepare the leaves and vessel, steep the infusion, then serve the ${goal}.`,
      finalDescription: `${goal} prepared from a controlled leaf infusion in a purpose-made cup.`,
      steps: [
        makeStep({ toolName: 'crush', inputs: ['tea leaves'], outputName: 'Prepared Tea Leaves', outputEmoji: '🌿', category: 'Food Ingredient', explanation: 'Sort and lightly crush the leaves so they infuse evenly.' }),
        makeStep({ toolName: 'mold', inputs: ['clay'], outputName: 'Fired Tea Cup', outputEmoji: '🍵', category: 'Serving Vessel', explanation: 'Form a heat-safe ceramic cup for the finished tea.' }),
        makeStep({ toolName: 'steep', inputs: ['Prepared Tea Leaves', 'filtered water', ...(lower.includes('chai') ? ['exotic spices'] : [])], outputName: 'Balanced Tea Infusion', outputEmoji: '🫖', category: 'Beverage Component', explanation: 'Steep the prepared leaves in filtered water at the appropriate strength.' }),
        ...(lower.includes('chai') ? [makeStep({ toolName: 'mix', inputs: ['Balanced Tea Infusion', 'milk'], outputName: 'Spiced Milk Tea', outputEmoji: '🥛', category: 'Beverage Component', explanation: 'Blend milk into the spiced infusion instead of adding unrelated crafting materials.' })] : []),
        makeStep({ toolName: 'serve', inputs: [lower.includes('chai') ? 'Spiced Milk Tea' : 'Balanced Tea Infusion', 'Fired Tea Cup'], outputName: goal, outputEmoji: '🍵', category: 'Finished Creation', explanation: `Pour the completed infusion into its cup and serve the ${goal}.` }),
      ],
    };
  }

  const produce = lower.includes('lemon') ? 'fresh lemons' : lower.includes('berry') ? 'fresh berries' : 'fresh fruit';
  return {
    domain: 'Cold beverage',
    sourceMaterials: [produce, 'filtered water', 'sugar', 'glass'],
    summary: `Plan: prepare the actual produce, balance the drink, make a glass, then serve the ${goal}.`,
    finalDescription: `${goal} prepared from fresh produce and balanced beverage ingredients.`,
    steps: [
      makeStep({ toolName: isJuice ? 'crush' : 'extract', inputs: [produce], outputName: 'Fresh Fruit Extract', outputEmoji: '🍹', category: 'Beverage Component', explanation: 'Extract the flavour and juice from produce appropriate to the requested drink.' }),
      makeStep({ toolName: 'filter', inputs: ['Fresh Fruit Extract', 'filtered water'], outputName: 'Filtered Beverage Base', outputEmoji: '💧', category: 'Beverage Component', explanation: 'Filter and dilute the extract into a clean beverage base.' }),
      makeStep({ toolName: 'mold', inputs: ['glass'], outputName: 'Chilled Serving Glass', outputEmoji: '🥛', category: 'Serving Vessel', explanation: 'Form a glass vessel instead of treating the drink like a metal or magical object.' }),
      makeStep({ toolName: 'mix', inputs: ['Filtered Beverage Base', 'sugar'], outputName: 'Balanced Sweetened Drink', outputEmoji: '🍹', category: 'Beverage Component', explanation: 'Balance the beverage with a measured amount of sugar.' }),
      makeStep({ toolName: 'serve', inputs: ['Balanced Sweetened Drink', 'Chilled Serving Glass'], outputName: goal, outputEmoji: '🍹', category: 'Finished Creation', explanation: `Serve the completed ${goal} in its prepared glass.` }),
    ],
  };
}

function createPizzaPlan(goal: string, lower: string): CraftingPlan {
  const specialtyTopping = lower.includes('truffle')
    ? 'fresh truffle'
    : lower.includes('pepperoni')
      ? 'pepperoni'
      : lower.includes('mushroom')
        ? 'fresh mushrooms'
        : null;
  return {
    domain: 'Pizza making',
    sourceMaterials: ['flour', 'filtered water', 'yeast', 'tomatoes', 'cheese', 'herb leaf', ...(specialtyTopping ? [specialtyTopping] : [])],
    summary: `Plan: make dough, sauce, and toppings separately before assembling and baking the ${goal}.`,
    finalDescription: `${goal} built from fermented dough, cooked tomato sauce, cheese, and a final bake.`,
    steps: [
      makeStep({ toolName: 'knead', inputs: ['flour', 'filtered water', 'yeast'], outputName: 'Fermented Pizza Dough', outputEmoji: '🍞', category: 'Food Component', explanation: 'Knead flour, water, and yeast into actual pizza dough.' }),
      makeStep({ toolName: 'simmer', inputs: ['tomatoes', 'herb leaf'], outputName: 'Herbed Tomato Sauce', outputEmoji: '🍅', category: 'Food Component', explanation: 'Cook tomatoes and herbs into a sauce rather than using an unrelated generic reduction.' }),
      makeStep({ toolName: 'shred', inputs: ['cheese'], outputName: 'Shredded Pizza Cheese', outputEmoji: '🧀', category: 'Food Component', explanation: 'Prepare the cheese so it melts evenly across the pizza.' }),
      makeStep({ toolName: 'shape', inputs: ['Fermented Pizza Dough'], outputName: 'Stretched Pizza Base', outputEmoji: '🫓', category: 'Food Component', explanation: 'Stretch the fermented dough into the correct base shape.' }),
      makeStep({ toolName: 'assemble', inputs: ['Stretched Pizza Base', 'Herbed Tomato Sauce', 'Shredded Pizza Cheese', ...(specialtyTopping ? [specialtyTopping] : [])], outputName: 'Unbaked Assembled Pizza', outputEmoji: '🍕', category: 'Food Component', explanation: specialtyTopping ? `Layer the prepared pizza components with ${specialtyTopping}, which the requested pizza actually calls for.` : 'Layer only the prepared pizza components in the correct order.' }),
      makeStep({ toolName: 'bake', inputs: ['Unbaked Assembled Pizza'], outputName: goal, outputEmoji: '🍕', category: 'Finished Creation', explanation: `Bake the assembled pizza to produce the finished ${goal}.` }),
    ],
  };
}

function createBakedDessertPlan(goal: string, lower: string): CraftingPlan {
  const chocolate = lower.includes('chocolate') || lower.includes('cocoa');
  return {
    domain: 'Baking',
    sourceMaterials: ['flour', 'eggs', 'milk', 'sugar', 'butter', ...(chocolate ? ['cocoa bean'] : [])],
    summary: `Plan: prepare dry and wet mixtures, form the batter, bake it, then finish the ${goal}.`,
    finalDescription: `${goal} produced through a coherent mixing, baking, cooling, and finishing sequence.`,
    steps: [
      makeStep({ toolName: 'grind', inputs: ['flour', 'sugar', ...(chocolate ? ['cocoa bean'] : [])], outputName: chocolate ? 'Chocolate Dry Mix' : 'Balanced Dry Mix', outputEmoji: '🥣', category: 'Food Component', explanation: 'Combine the dry baking ingredients at a consistent texture.' }),
      makeStep({ toolName: 'whisk', inputs: ['eggs', 'milk', 'butter'], outputName: 'Aerated Wet Mixture', outputEmoji: '🥚', category: 'Food Component', explanation: 'Whisk the wet ingredients to build the structure needed for baking.' }),
      makeStep({ toolName: 'mix', inputs: [chocolate ? 'Chocolate Dry Mix' : 'Balanced Dry Mix', 'Aerated Wet Mixture'], outputName: 'Prepared Cake Batter', outputEmoji: '🥣', category: 'Food Component', explanation: 'Fold the dry and wet mixtures into a cohesive batter.' }),
      makeStep({ toolName: 'mold', inputs: ['Prepared Cake Batter'], outputName: 'Shaped Unbaked Batter', outputEmoji: '🧁', category: 'Food Component', explanation: 'Portion the batter into the form required by the requested dessert.' }),
      makeStep({ toolName: 'bake', inputs: ['Shaped Unbaked Batter'], outputName: 'Baked Dessert Base', outputEmoji: '🍰', category: 'Food Component', explanation: 'Bake the shaped batter before any decoration is added.' }),
      makeStep({ toolName: 'garnish', inputs: ['Baked Dessert Base', 'sugar'], outputName: goal, outputEmoji: '🍰', category: 'Finished Creation', explanation: `Cool and finish the baked base as the requested ${goal}.` }),
    ],
  };
}

function createMealPlan(goal: string, lower: string): CraftingPlan {
  const ramen = includesAny(lower, ['ramen', 'noodle']);
  const burger = includesAny(lower, ['burger', 'sandwich']);
  if (ramen) {
    return {
      domain: 'Noodle cookery',
      sourceMaterials: ['flour', 'eggs', 'filtered water', 'rich broth', 'pork', 'herb leaf', 'exotic spices'],
      summary: `Plan: make noodles, broth, and toppings separately before assembling the ${goal}.`,
      finalDescription: `${goal} assembled from fresh noodles, developed broth, cooked protein, and appropriate garnish.`,
      steps: [
        makeStep({ toolName: 'knead', inputs: ['flour', 'eggs', 'filtered water'], outputName: 'Fresh Ramen Dough', outputEmoji: '🍞', category: 'Food Component', explanation: 'Knead flour, egg, and water into noodle dough.' }),
        makeStep({ toolName: 'cut', inputs: ['Fresh Ramen Dough'], outputName: 'Fresh Ramen Noodles', outputEmoji: '🍜', category: 'Food Component', explanation: 'Cut the rested dough into actual ramen noodles.' }),
        makeStep({ toolName: 'simmer', inputs: ['rich broth', 'exotic spices'], outputName: 'Developed Ramen Broth', outputEmoji: '🍲', category: 'Food Component', explanation: 'Simmer the broth with seasoning to develop the soup base.' }),
        makeStep({ toolName: 'roast', inputs: ['pork'], outputName: 'Roasted Pork Topping', outputEmoji: '🍖', category: 'Food Component', explanation: 'Cook a suitable protein topping separately.' }),
        makeStep({ toolName: 'boil', inputs: ['Fresh Ramen Noodles', 'filtered water'], outputName: 'Cooked Ramen Noodles', outputEmoji: '🍜', category: 'Food Component', explanation: 'Boil the noodles only after they have been formed.' }),
        makeStep({ toolName: 'garnish', inputs: ['Cooked Ramen Noodles', 'Developed Ramen Broth', 'Roasted Pork Topping', 'herb leaf'], outputName: goal, outputEmoji: '🍜', category: 'Finished Creation', explanation: `Assemble the cooked components into the finished ${goal}.` }),
      ],
    };
  }

  if (burger) {
    return {
      domain: 'Grill cookery',
      sourceMaterials: ['ground beef', 'flour', 'yeast', 'filtered water', 'cheese', 'tomatoes', 'herb leaf'],
      summary: `Plan: prepare the bun, patty, and toppings independently before assembling the ${goal}.`,
      finalDescription: `${goal} assembled from a grilled patty, baked bun, and prepared toppings.`,
      steps: [
        makeStep({ toolName: 'knead', inputs: ['flour', 'yeast', 'filtered water'], outputName: 'Bread Bun Dough', outputEmoji: '🍞', category: 'Food Component', explanation: 'Make an appropriate yeast dough for the bun.' }),
        makeStep({ toolName: 'bake', inputs: ['Bread Bun Dough'], outputName: 'Fresh Baked Bun', outputEmoji: '🍞', category: 'Food Component', explanation: 'Bake the bun before building the sandwich.' }),
        makeStep({ toolName: 'shape', inputs: ['ground beef'], outputName: 'Seasoned Burger Patty', outputEmoji: '🥩', category: 'Food Component', explanation: 'Shape the ground beef into a properly sized patty.' }),
        makeStep({ toolName: 'grill', inputs: ['Seasoned Burger Patty'], outputName: 'Grilled Burger Patty', outputEmoji: '🍖', category: 'Food Component', explanation: 'Cook the patty using a suitable high-heat process.' }),
        makeStep({ toolName: 'chop', inputs: ['tomatoes', 'herb leaf', 'cheese'], outputName: 'Prepared Burger Toppings', outputEmoji: '🥬', category: 'Food Component', explanation: 'Slice and portion toppings that belong on the requested burger.' }),
        makeStep({ toolName: 'assemble', inputs: ['Fresh Baked Bun', 'Grilled Burger Patty', 'Prepared Burger Toppings'], outputName: goal, outputEmoji: '🍔', category: 'Finished Creation', explanation: `Stack the prepared components into the finished ${goal}.` }),
      ],
    };
  }

  return {
    domain: 'Cookery',
    sourceMaterials: ['fresh produce', 'cooking oil', 'exotic spices', 'herb leaf'],
    summary: `Plan: prepare, season, cook, and plate ingredients appropriate to the ${goal}.`,
    finalDescription: `${goal} made through sensible culinary preparation and cooking stages.`,
    steps: [
      makeStep({ toolName: 'chop', inputs: ['fresh produce'], outputName: 'Prepared Fresh Ingredients', outputEmoji: '🥕', category: 'Food Component', explanation: 'Wash and cut the produce before cooking it.' }),
      makeStep({ toolName: 'season', inputs: ['Prepared Fresh Ingredients', 'exotic spices'], outputName: 'Seasoned Ingredients', outputEmoji: '🧂', category: 'Food Component', explanation: 'Season the prepared ingredients according to the requested dish.' }),
      makeStep({ toolName: 'saute', inputs: ['Seasoned Ingredients', 'cooking oil'], outputName: 'Cooked Main Components', outputEmoji: '🥘', category: 'Food Component', explanation: 'Cook the main components with an appropriate culinary method.' }),
      makeStep({ toolName: 'simmer', inputs: ['Cooked Main Components'], outputName: 'Finished Dish Base', outputEmoji: '🍲', category: 'Food Component', explanation: 'Bring the cooked components together and finish their texture.' }),
      makeStep({ toolName: 'garnish', inputs: ['Finished Dish Base', 'herb leaf'], outputName: goal, outputEmoji: '🍽️', category: 'Finished Creation', explanation: `Plate and garnish the finished ${goal}.` }),
    ],
  };
}

function createWeaponPlan(goal: string, lower: string): CraftingPlan {
  const isEnergyWeapon = includesAny(lower, ['laser', 'light sword', 'lightsaber', 'energy blade', 'plasma']);
  if (isEnergyWeapon) {
    return {
      domain: 'Energy weapon engineering',
      sourceMaterials: ['titanium alloy', 'quartz crystal', 'circuit board', 'microchip', 'copper wire', 'high-density power cell', 'leather strip'],
      summary: `Plan: machine the hilt, tune an optical focus, program the emitter controls, build its power circuit, then assemble and calibrate the ${goal}.`,
      finalDescription: `${goal} engineered from a machined hilt, tuned focusing crystal, controlled emitter, and dedicated power system.`,
      steps: [
        makeStep({ toolName: 'machine', inputs: ['titanium alloy'], outputName: 'Machined Emitter Hilt', outputEmoji: '🔩', category: 'Weapon Component', explanation: 'Machine a heat-resistant hilt with space for the emitter, controls, and power cell.' }),
        makeStep({ toolName: 'crystallize', inputs: ['quartz crystal'], outputName: 'Tuned Focusing Crystal', outputEmoji: '💎', category: 'Optical Component', explanation: 'Tune a clear crystal to focus the emitted energy into a stable blade.' }),
        makeStep({ toolName: 'program', inputs: ['circuit board', 'microchip'], outputName: 'Programmed Emitter Controller', outputEmoji: '💻', category: 'Electronic Component', explanation: 'Program ignition, field stability, and safety controls for the emitter.' }),
        makeStep({ toolName: 'wire', inputs: ['Programmed Emitter Controller', 'copper wire', 'high-density power cell'], outputName: 'Powered Emitter Circuit', outputEmoji: '🔋', category: 'Powered Sub-Assembly', explanation: 'Connect the controller to a power cell sized for the energy emitter.' }),
        makeStep({ toolName: 'assemble', inputs: ['Machined Emitter Hilt', 'Tuned Focusing Crystal', 'Powered Emitter Circuit', 'leather strip'], outputName: 'Assembled Energy Hilt', outputEmoji: '🗡️', category: 'Weapon Assembly', explanation: 'Install the focus and powered emitter into the hilt, then wrap the grip.' }),
        makeStep({ toolName: 'calibrate', inputs: ['Assembled Energy Hilt'], outputName: goal, outputEmoji: '⚔️', category: 'Finished Creation', explanation: `Tune blade length, field stability, and safety cutoffs to complete the ${goal}.` }),
      ],
    };
  }

  const isBow = includesAny(lower, ['bow', 'crossbow']);
  if (isBow) {
    return {
      domain: 'Bow making',
      sourceMaterials: ['seasoned hardwood', 'fiber cable', 'leather strip', 'steel ingot'],
      summary: `Plan: shape the bow body, make its string and fittings, assemble them, then tune the ${goal}.`,
      finalDescription: `${goal} built from a shaped hardwood body, tensioned string, and fitted hardware.`,
      steps: [
        makeStep({ toolName: 'carve', inputs: ['seasoned hardwood'], outputName: 'Shaped Bow Stave', outputEmoji: '🪵', category: 'Weapon Component', explanation: 'Carve a flexible hardwood stave suited to the requested bow.' }),
        makeStep({ toolName: 'weave', inputs: ['fiber cable'], outputName: 'Tensioned Bowstring', outputEmoji: '🧵', category: 'Weapon Component', explanation: 'Twist strong fibres into the working string.' }),
        makeStep({ toolName: 'forge', inputs: ['steel ingot'], outputName: 'Bow Fittings', outputEmoji: '🔩', category: 'Weapon Component', explanation: 'Forge only the small metal fittings needed by the bow.' }),
        makeStep({ toolName: 'assemble', inputs: ['Shaped Bow Stave', 'Tensioned Bowstring', 'Bow Fittings'], outputName: 'Strung Bow Assembly', outputEmoji: '🏹', category: 'Weapon Assembly', explanation: 'Join the stave, string, and fittings into a functional assembly.' }),
        makeStep({ toolName: 'tune', inputs: ['Strung Bow Assembly', 'leather strip'], outputName: goal, outputEmoji: '🏹', category: 'Finished Creation', explanation: `Set draw tension and wrap the grip to finish the ${goal}.` }),
      ],
    };
  }

  const usesGold = includesAny(lower, ['gold', 'royal', 'ornate']);
  return {
    domain: 'Weapon smithing',
    sourceMaterials: ['iron ore', 'coal', 'seasoned hardwood', 'leather strip', ...(usesGold ? ['gold dust'] : [])],
    summary: `Plan: refine steel, forge the weapon head, make the grip, assemble it, then heat-treat and finish the ${goal}.`,
    finalDescription: `${goal} built from refined steel, a fitted grip, proper assembly, heat treatment, and finishing.`,
    steps: [
      makeStep({ toolName: 'smelt', inputs: ['iron ore', 'coal'], outputName: 'High-Carbon Steel Billet', outputEmoji: '🧱', category: 'Metal Stock', explanation: 'Smelt iron with carbon into workable weapon-grade steel.' }),
      makeStep({ toolName: 'forge', inputs: ['High-Carbon Steel Billet'], outputName: 'Forged Weapon Blank', outputEmoji: '🗡️', category: 'Weapon Component', explanation: 'Forge the steel billet into the correct blade or weapon-head profile.' }),
      makeStep({ toolName: 'carve', inputs: ['seasoned hardwood', 'leather strip'], outputName: 'Fitted Grip Assembly', outputEmoji: '🪵', category: 'Weapon Component', explanation: 'Carve a balanced handle and wrap it with leather for control.' }),
      makeStep({ toolName: 'assemble', inputs: ['Forged Weapon Blank', 'Fitted Grip Assembly'], outputName: 'Fitted Weapon Assembly', outputEmoji: '⚔️', category: 'Weapon Assembly', explanation: 'Mechanically fit the weapon blank to its grip before heat treatment.' }),
      makeStep({ toolName: 'temper', inputs: ['Fitted Weapon Assembly'], outputName: 'Hardened Weapon Assembly', outputEmoji: '🔥', category: 'Weapon Assembly', explanation: 'Heat-treat the steel so the working edge is hard without becoming brittle.' }),
      makeStep({ toolName: usesGold ? 'engrave' : 'polish', inputs: ['Hardened Weapon Assembly', ...(usesGold ? ['gold dust'] : [])], outputName: goal, outputEmoji: '⚔️', category: 'Finished Creation', explanation: usesGold ? `Add the requested gold inlay and finish the ${goal}.` : `Sharpen, polish, and inspect the finished ${goal}.` }),
    ],
  };
}

function createArmorPlan(goal: string, lower: string): CraftingPlan {
  const isShield = lower.includes('shield');
  const body = isShield ? 'Forged Shield Face' : `Forged ${goal} Plates`;
  const fittedBody = isShield ? 'Shaped Shield Body' : `Fitted ${goal} Plates`;
  const emoji = isShield ? '🛡️' : '🦺';
  return {
    domain: isShield ? 'Shield making' : 'Armorsmithing',
    sourceMaterials: ['iron ore', 'coal', 'leather hide', 'cotton fiber', 'steel fasteners'],
    summary: `Plan: refine the metal, forge and shape the protective body, make its padding and straps, then assemble and temper the ${goal}.`,
    finalDescription: `${goal} built from shaped steel protection, fitted padding, secure straps, and a hardened final assembly.`,
    steps: [
      makeStep({ toolName: 'smelt', inputs: ['iron ore', 'coal'], outputName: 'Protective Steel Billet', outputEmoji: '🧱', category: 'Metal Stock', explanation: 'Refine iron and carbon into steel suitable for protective equipment.' }),
      makeStep({ toolName: 'forge', inputs: ['Protective Steel Billet'], outputName: body, outputEmoji: emoji, category: 'Armor Component', explanation: `Forge broad protective sections appropriate to the ${goal}, not a weapon blade.` }),
      makeStep({ toolName: 'shape', inputs: [body], outputName: fittedBody, outputEmoji: emoji, category: 'Armor Component', explanation: 'Curve and fit the forged metal so it can safely deflect impacts.' }),
      makeStep({ toolName: 'stitch', inputs: ['leather hide', 'cotton fiber'], outputName: 'Padded Strap Assembly', outputEmoji: '🧵', category: 'Armor Component', explanation: 'Make the padding and retention straps that hold the protection securely.' }),
      makeStep({ toolName: 'assemble', inputs: [fittedBody, 'Padded Strap Assembly', 'steel fasteners'], outputName: `Fitted ${goal} Assembly`, outputEmoji: emoji, category: 'Armor Assembly', explanation: 'Fasten the protective body to its padding and straps.' }),
      makeStep({ toolName: 'temper', inputs: [`Fitted ${goal} Assembly`], outputName: goal, outputEmoji: emoji, category: 'Finished Creation', explanation: `Harden, deburr, and inspect the protective surfaces to finish the ${goal}.` }),
    ],
  };
}

function createTechnologyPlan(goal: string, lower: string): CraftingPlan {
  const isQuantumSystem = includesAny(lower, ['quantum', 'fusion reactor', 'particle reactor']);
  if (isQuantumSystem) {
    return {
      domain: 'Quantum systems engineering',
      sourceMaterials: ['containment alloy', 'superconducting wire', 'quantum substrate', 'circuit board', 'microchip', 'cryogenic coolant'],
      summary: `Plan: machine a containment chamber, form the superconducting field coil, program its controller, integrate the quantum core, then cool and calibrate the ${goal}.`,
      finalDescription: `${goal} engineered from a shielded containment chamber, superconducting field system, controlled quantum substrate, and cryogenic stabilization.`,
      steps: [
        makeStep({ toolName: 'machine', inputs: ['containment alloy'], outputName: 'Shielded Containment Chamber', outputEmoji: '⚙️', category: 'Reactor Structure', explanation: 'Machine a pressure-rated chamber from alloy selected to contain the system safely.' }),
        makeStep({ toolName: 'weave', inputs: ['superconducting wire'], outputName: 'Superconducting Field Coil', outputEmoji: '🧲', category: 'Reactor Component', explanation: 'Wind the superconducting conductor into a controlled confinement coil.' }),
        makeStep({ toolName: 'program', inputs: ['circuit board', 'microchip'], outputName: 'Programmed Field Controller', outputEmoji: '💻', category: 'Electronic Component', explanation: 'Program real-time containment monitoring and field correction logic.' }),
        makeStep({ toolName: 'assemble', inputs: ['quantum substrate', 'Superconducting Field Coil'], outputName: 'Contained Quantum Core', outputEmoji: '⚛️', category: 'Reactor Core', explanation: 'Seat the active substrate inside the field coil before energizing it.' }),
        makeStep({ toolName: 'wire', inputs: ['Shielded Containment Chamber', 'Contained Quantum Core', 'Programmed Field Controller'], outputName: `Integrated ${goal} Assembly`, outputEmoji: '🔌', category: 'Reactor Assembly', explanation: 'Install the controlled core inside its containment chamber and connect its monitoring circuits.' }),
        makeStep({ toolName: 'infuse', inputs: [`Integrated ${goal} Assembly`, 'cryogenic coolant'], outputName: `Cryogenically Stabilized ${goal}`, outputEmoji: '❄️', category: 'Reactor Assembly', explanation: 'Cool the superconducting field system into its stable operating range.' }),
        makeStep({ toolName: 'calibrate', inputs: [`Cryogenically Stabilized ${goal}`], outputName: goal, outputEmoji: '⚛️', category: 'Finished Creation', explanation: `Test containment and tune the control field to complete the ${goal}.` }),
      ],
    };
  }

  const isSpacecraft = includesAny(lower, ['rocket', 'shuttle', 'spacecraft', 'starship']);
  if (isSpacecraft) {
    return {
      domain: 'Spacecraft engineering',
      sourceMaterials: ['aluminum alloy', 'titanium alloy', 'thermal ceramic', 'circuit board', 'microchip', 'copper wire', 'rocket propellant'],
      summary: `Plan: fabricate a lightweight airframe and heat shield, build guidance and propulsion separately, integrate them, then test the ${goal}.`,
      finalDescription: `${goal} engineered from a lightweight pressure structure, thermal protection, guidance avionics, and a purpose-built propulsion system.`,
      steps: [
        makeStep({ toolName: 'forge', inputs: ['aluminum alloy', 'titanium alloy'], outputName: 'Pressure-Rated Airframe', outputEmoji: '🚀', category: 'Aerospace Structure', explanation: 'Form a strong, lightweight airframe suited to launch and atmospheric loads.' }),
        makeStep({ toolName: 'mold', inputs: ['thermal ceramic'], outputName: 'Fitted Thermal Shield', outputEmoji: '🛡️', category: 'Aerospace Structure', explanation: 'Shape ceramic thermal protection around the high-heat surfaces.' }),
        makeStep({ toolName: 'program', inputs: ['circuit board', 'microchip'], outputName: 'Programmed Guidance Computer', outputEmoji: '💻', category: 'Avionics Component', explanation: 'Program navigation, flight control, and safety logic for the mission profile.' }),
        makeStep({ toolName: 'wire', inputs: ['Programmed Guidance Computer', 'copper wire'], outputName: 'Integrated Flight Avionics', outputEmoji: '🛰️', category: 'Avionics Assembly', explanation: 'Wire the guidance computer to sensors and flight-control interfaces.' }),
        makeStep({ toolName: 'machine', inputs: ['titanium alloy'], outputName: 'Rocket Engine Module', outputEmoji: '🔥', category: 'Propulsion Component', explanation: 'Machine a heat-resistant engine and feed system from aerospace alloy.' }),
        makeStep({ toolName: 'fuel', inputs: ['Rocket Engine Module', 'rocket propellant'], outputName: 'Fueled Propulsion Module', outputEmoji: '🔥', category: 'Propulsion Assembly', explanation: 'Load the engine module with the propellant it was designed to use.' }),
        makeStep({ toolName: 'assemble', inputs: ['Pressure-Rated Airframe', 'Fitted Thermal Shield', 'Integrated Flight Avionics', 'Fueled Propulsion Module'], outputName: `Integrated ${goal} Prototype`, outputEmoji: '🚀', category: 'Flight Prototype', explanation: 'Integrate structure, thermal protection, avionics, and propulsion into one vehicle.' }),
        makeStep({ toolName: 'calibrate', inputs: [`Integrated ${goal} Prototype`], outputName: goal, outputEmoji: '🚀', category: 'Finished Creation', explanation: `Run pressure, guidance, engine, and control checks to complete the ${goal}.` }),
      ],
    };
  }

  const vehicle = includesAny(lower, ['car', 'truck', 'vehicle', 'rocket', 'shuttle', 'ship']);
  const isWatch = includesAny(lower, ['watch', 'clock', 'timer']);
  const housing = vehicle ? 'Structural Chassis' : isWatch ? 'Precision Watch Case' : 'Protective Device Housing';
  const power = vehicle ? 'Integrated Powertrain' : 'Regulated Power Module';

  return {
    domain: vehicle ? 'Vehicle engineering' : 'Electronics engineering',
    sourceMaterials: ['silicon', 'copper wire', 'microchip', 'circuit board', 'battery', 'steel ingot', 'glass', ...(vehicle ? ['rubber'] : [])],
    summary: `Plan: fabricate the structure and electronics separately, program the controller, wire power, assemble, then calibrate the ${goal}.`,
    finalDescription: `${goal} engineered from a dedicated structure, control electronics, power system, and calibrated final assembly.`,
    steps: [
      makeStep({ toolName: vehicle ? 'forge' : 'laser_cut', inputs: ['steel ingot', ...(isWatch ? ['glass'] : [])], outputName: housing, outputEmoji: vehicle ? '🏗️' : '⚙️', category: 'Structural Component', explanation: `Fabricate the ${vehicle ? 'load-bearing chassis' : 'protective housing'} to the dimensions required by the ${goal}.` }),
      makeStep({ toolName: 'laser_cut', inputs: ['silicon', 'circuit board'], outputName: 'Precision Logic Substrate', outputEmoji: '🟩', category: 'Electronic Component', explanation: 'Cut the silicon and circuit substrate into a purpose-built control board.' }),
      makeStep({ toolName: 'program', inputs: ['microchip', 'Precision Logic Substrate'], outputName: 'Programmed Control Module', outputEmoji: '💻', category: 'Electronic Component', explanation: `Program the controller for the actual functions required by the ${goal}.` }),
      makeStep({ toolName: 'wire', inputs: ['Programmed Control Module', 'battery', 'copper wire'], outputName: power, outputEmoji: '🔋', category: 'Powered Sub-Assembly', explanation: 'Connect the controller to a regulated power source with suitable conductors.' }),
      makeStep({ toolName: 'assemble', inputs: [housing, power, ...(vehicle ? ['rubber'] : [])], outputName: `Assembled ${goal} Prototype`, outputEmoji: vehicle ? '🚗' : '🔧', category: 'Functional Prototype', explanation: 'Install the powered electronics into the structure before final testing.' }),
      makeStep({ toolName: 'calibrate', inputs: [`Assembled ${goal} Prototype`], outputName: goal, outputEmoji: vehicle ? '🚀' : isWatch ? '⌚' : '📱', category: 'Finished Creation', explanation: `Test, tune, and calibrate every function of the finished ${goal}.` }),
    ],
  };
}

function createAlchemyPlan(goal: string, lower: string): CraftingPlan {
  const invisibility = lower.includes('invisib');
  const activeBotanical = invisibility ? 'moonflower petals' : 'medicinal herbs';
  const catalyst = invisibility ? 'spectral salt' : 'mineral catalyst';
  const essence = invisibility ? 'Optical-Bending Essence' : 'Concentrated Herbal Essence';
  return {
    domain: 'Alchemy',
    sourceMaterials: [activeBotanical, catalyst, 'filtered water', 'glass', 'cork stopper'],
    summary: `Plan: prepare the active ingredients, distill a clean solvent, extract and brew the essence, then filter and bottle the ${goal}.`,
    finalDescription: `${goal} brewed from purpose-selected active ingredients, a distilled solvent, controlled extraction, and clean bottling.`,
    steps: [
      makeStep({ toolName: 'grind', inputs: [activeBotanical, catalyst], outputName: 'Prepared Alchemical Reagents', outputEmoji: '🌿', category: 'Alchemy Reagent', explanation: `Grind ${activeBotanical} with a compatible catalyst to expose the desired active properties.` }),
      makeStep({ toolName: 'distill', inputs: ['filtered water'], outputName: 'Purified Alchemical Solvent', outputEmoji: '💧', category: 'Alchemy Reagent', explanation: 'Distill the water so impurities cannot interfere with the reaction.' }),
      makeStep({ toolName: 'extract', inputs: ['Prepared Alchemical Reagents', 'Purified Alchemical Solvent'], outputName: essence, outputEmoji: '✨', category: 'Active Essence', explanation: invisibility ? 'Extract the compounds intended to bend visible light around the user.' : 'Extract the useful compounds from the prepared herbs into the solvent.' }),
      makeStep({ toolName: 'brew', inputs: [essence], outputName: `Brewed ${goal}`, outputEmoji: '🧪', category: 'Potion Base', explanation: 'Brew the extracted essence at a controlled temperature until its effect stabilizes.' }),
      makeStep({ toolName: 'filter', inputs: [`Brewed ${goal}`], outputName: `Filtered ${goal}`, outputEmoji: '🧪', category: 'Potion Base', explanation: 'Remove spent reagent particles before the potion is sealed.' }),
      makeStep({ toolName: 'mold', inputs: ['glass'], outputName: 'Glass Potion Flask', outputEmoji: '⚗️', category: 'Serving Vessel', explanation: 'Form a chemically stable glass flask for the finished liquid.' }),
      makeStep({ toolName: 'bottle', inputs: [`Filtered ${goal}`, 'Glass Potion Flask', 'cork stopper'], outputName: goal, outputEmoji: '🧪', category: 'Finished Creation', explanation: `Bottle and seal the filtered liquid to complete the ${goal}.` }),
    ],
  };
}

function createMagicPlan(goal: string, lower: string): CraftingPlan {
  const isBook = includesAny(lower, ['book', 'grimoire', 'tome', 'scroll']);
  const isJewelry = includesAny(lower, ['ring', 'amulet', 'pendant', 'crown']);
  const baseMaterial = isBook ? 'parchment' : isJewelry ? 'silver ingot' : 'seasoned hardwood';
  const formedBase = isBook ? 'Bound Parchment Folio' : isJewelry ? 'Shaped Silver Setting' : 'Carved Focus Shaft';
  const namedCore = lower.includes('phoenix feather') ? 'phoenix feather' : lower.includes('dragon') ? 'dragon scale' : null;
  return {
    domain: 'Arcane craftsmanship',
    sourceMaterials: [baseMaterial, 'mana crystal', 'quartz', 'gold dust', 'starlight', ...(namedCore ? [namedCore] : [])],
    summary: `Plan: form a suitable physical base, prepare a focus crystal, bind both, inscribe a purpose, then enchant the ${goal}.`,
    finalDescription: `${goal} created from a suitable physical base, focused crystal, binding, inscription, and controlled enchantment.`,
    steps: [
      makeStep({ toolName: isBook ? 'bind' : isJewelry ? 'forge' : 'carve', inputs: [baseMaterial], outputName: formedBase, outputEmoji: isBook ? '📖' : isJewelry ? '💍' : '🪵', category: 'Artifact Component', explanation: `Create a physical base appropriate to a ${goal}, rather than a generic metal chassis.` }),
      makeStep({ toolName: 'crystallize', inputs: ['mana crystal', 'quartz'], outputName: 'Tuned Arcane Focus', outputEmoji: '💎', category: 'Magic Component', explanation: 'Prepare a stable crystal focus to hold and direct the enchantment.' }),
      makeStep({ toolName: 'bind', inputs: [formedBase, 'Tuned Arcane Focus', 'gold dust', ...(namedCore ? [namedCore] : [])], outputName: 'Focus-Bound Artifact', outputEmoji: '🔮', category: 'Artifact Assembly', explanation: namedCore ? `Bind the tuned focus and requested ${namedCore} into the physical base.` : 'Secure the focus to the physical base with a conductive binding.' }),
      makeStep({ toolName: 'inscribe', inputs: ['Focus-Bound Artifact'], outputName: 'Inscribed Artifact Blank', outputEmoji: '✒️', category: 'Artifact Assembly', explanation: `Inscribe the specific function the ${goal} is supposed to perform.` }),
      makeStep({ toolName: 'enchant', inputs: ['Inscribed Artifact Blank', 'starlight'], outputName: 'Energized Arcane Artifact', outputEmoji: '✨', category: 'Magic Assembly', explanation: 'Charge the inscription through the prepared focus under controlled conditions.' }),
      makeStep({ toolName: 'polish', inputs: ['Energized Arcane Artifact'], outputName: goal, outputEmoji: '🪄', category: 'Finished Creation', explanation: `Finish and inspect the completed ${goal} without adding unrelated materials.` }),
    ],
  };
}

function createTextilePlan(goal: string, lower: string): CraftingPlan {
  const insulated = includesAny(lower, ['winter', 'parka', 'warm', 'insulated']);
  return {
    domain: 'Textile craft',
    sourceMaterials: ['cotton fiber', 'dye', 'thread', 'leather strip', ...(insulated ? ['wool batting'] : [])],
    summary: `Plan: spin and weave fabric, dye it, cut a pattern, stitch the garment, then finish the ${goal}.`,
    finalDescription: `${goal} made from woven, dyed, cut, and properly stitched textile components.`,
    steps: [
      makeStep({ toolName: 'weave_cloth', inputs: ['cotton fiber', 'thread'], outputName: 'Woven Textile Bolt', outputEmoji: '🧵', category: 'Textile Material', explanation: 'Turn fibres and thread into usable cloth before attempting to form the item.' }),
      makeStep({ toolName: 'infuse', inputs: ['Woven Textile Bolt', 'dye'], outputName: 'Dyed Finished Fabric', outputEmoji: '🎨', category: 'Textile Material', explanation: 'Dye the fabric evenly while it is still a flat textile bolt.' }),
      makeStep({ toolName: 'cut', inputs: ['Dyed Finished Fabric'], outputName: `Cut ${goal} Pattern`, outputEmoji: '✂️', category: 'Textile Component', explanation: `Cut pattern pieces specifically shaped for the ${goal}.` }),
      makeStep({ toolName: 'stitch', inputs: [`Cut ${goal} Pattern`, 'thread', ...(insulated ? ['wool batting'] : [])], outputName: `Stitched ${goal} Shell`, outputEmoji: '🪡', category: 'Textile Assembly', explanation: insulated ? 'Stitch the cut panels around insulating wool batting for warmth.' : 'Stitch the cut panels into the requested form.' }),
      makeStep({ toolName: 'bind', inputs: [`Stitched ${goal} Shell`, 'leather strip'], outputName: goal, outputEmoji: '🧥', category: 'Finished Creation', explanation: `Reinforce closures and finish the completed ${goal}.` }),
    ],
  };
}

function createJewelryPlan(goal: string, lower: string): CraftingPlan {
  const metal = lower.includes('gold') ? 'gold ingot' : lower.includes('silver') ? 'silver ingot' : 'jewelry silver';
  const usesGem = includesAny(lower, ['diamond', 'ruby', 'emerald', 'sapphire', 'gem', 'jewel']);
  const gem = lower.includes('diamond') ? 'rough diamond' : lower.includes('ruby') ? 'rough ruby' : lower.includes('emerald') ? 'rough emerald' : lower.includes('sapphire') ? 'rough sapphire' : 'rough gemstone';
  return {
    domain: 'Jewelry making',
    sourceMaterials: [metal, ...(usesGem ? [gem] : []), 'polishing compound'],
    summary: `Plan: refine and shape the precious metal${usesGem ? ', cut the selected stone,' : ''} assemble the setting, then polish and inspect the ${goal}.`,
    finalDescription: `${goal} made from shaped precious metal${usesGem ? ' and a properly cut gemstone' : ''}, with a fitted and polished finish.`,
    steps: [
      makeStep({ toolName: 'smelt', inputs: [metal], outputName: 'Refined Jewelry Metal', outputEmoji: '✨', category: 'Jewelry Material', explanation: 'Refine the selected precious metal into clean, workable stock.' }),
      makeStep({ toolName: 'forge', inputs: ['Refined Jewelry Metal'], outputName: `Shaped ${goal} Setting`, outputEmoji: '💍', category: 'Jewelry Component', explanation: `Shape the metal into the proportions and setting required by the ${goal}.` }),
      ...(usesGem ? [makeStep({ toolName: 'cut', inputs: [gem], outputName: 'Faceted Gemstone', outputEmoji: '💎', category: 'Jewelry Component', explanation: 'Cut and facet the selected stone so it fits the prepared setting.' })] : []),
      makeStep({ toolName: 'assemble', inputs: [`Shaped ${goal} Setting`, ...(usesGem ? ['Faceted Gemstone'] : [])], outputName: `Assembled ${goal}`, outputEmoji: '💍', category: 'Jewelry Assembly', explanation: 'Join the fitted jewelry components without introducing unrelated materials.' }),
      makeStep({ toolName: 'polish', inputs: [`Assembled ${goal}`, 'polishing compound'], outputName: goal, outputEmoji: '💍', category: 'Finished Creation', explanation: `Polish the surfaces and inspect the setting to complete the ${goal}.` }),
    ],
  };
}

function createBookPlan(goal: string): CraftingPlan {
  return {
    domain: 'Bookbinding',
    sourceMaterials: ['wood pulp', 'cotton fiber', 'printing ink', 'thread', 'cardboard', 'leather hide'],
    summary: `Plan: form paper, print the pages, fold and sew them into signatures, make the cover, then bind the ${goal}.`,
    finalDescription: `${goal} made from printed paper signatures, a reinforced cover, and a properly sewn binding.`,
    steps: [
      makeStep({ toolName: 'mix', inputs: ['wood pulp', 'cotton fiber'], outputName: 'Archival Paper Pulp', outputEmoji: '📄', category: 'Book Material', explanation: 'Blend pulp and cotton fibre into durable paper stock.' }),
      makeStep({ toolName: 'compress', inputs: ['Archival Paper Pulp'], outputName: 'Finished Paper Sheets', outputEmoji: '📄', category: 'Book Material', explanation: 'Press and dry the pulp into consistent sheets before printing.' }),
      makeStep({ toolName: 'inscribe', inputs: ['Finished Paper Sheets', 'printing ink'], outputName: 'Printed Page Set', outputEmoji: '📑', category: 'Book Component', explanation: `Print the content and page order intended for the ${goal}.` }),
      makeStep({ toolName: 'stitch', inputs: ['Printed Page Set', 'thread'], outputName: 'Sewn Page Signatures', outputEmoji: '🪡', category: 'Book Component', explanation: 'Fold and sew the printed pages into durable signatures.' }),
      makeStep({ toolName: 'cut', inputs: ['cardboard', 'leather hide'], outputName: 'Fitted Book Cover', outputEmoji: '📕', category: 'Book Component', explanation: 'Cut a rigid cover and protective outer material to the page-block dimensions.' }),
      makeStep({ toolName: 'bind', inputs: ['Sewn Page Signatures', 'Fitted Book Cover'], outputName: goal, outputEmoji: '📕', category: 'Finished Creation', explanation: `Bind the sewn pages into their fitted cover to complete the ${goal}.` }),
    ],
  };
}

function createPrintedCardPlan(goal: string): CraftingPlan {
  return {
    domain: 'Printed credential production',
    sourceMaterials: ['wood pulp', 'cotton fiber', 'printing ink', 'clear polymer film'],
    summary: `Plan: form card stock, print the identifying face, add its validation mark, then laminate the ${goal}.`,
    finalDescription: `${goal} produced from reinforced card stock, printed information, validation features, and protective laminate.`,
    steps: [
      makeStep({ toolName: 'mix', inputs: ['wood pulp', 'cotton fiber'], outputName: 'Reinforced Paper Pulp', outputEmoji: '🧻', category: 'Print Material', explanation: 'Blend paper pulp with cotton fibre to create durable card stock.' }),
      makeStep({ toolName: 'compress', inputs: ['Reinforced Paper Pulp'], outputName: 'Blank Card Stock', outputEmoji: '🎫', category: 'Print Material', explanation: 'Press the pulp into a flat, consistently sized card.' }),
      makeStep({ toolName: 'inscribe', inputs: ['Blank Card Stock', 'printing ink'], outputName: `Printed ${goal} Face`, outputEmoji: '🪪', category: 'Printed Component', explanation: `Print the information and layout that make it recognizably a ${goal}.` }),
      makeStep({ toolName: 'engrave', inputs: [`Printed ${goal} Face`], outputName: `Validated ${goal} Insert`, outputEmoji: '✅', category: 'Printed Component', explanation: 'Add the serial or validation mark before sealing the card.' }),
      makeStep({ toolName: 'laminate', inputs: [`Validated ${goal} Insert`, 'clear polymer film'], outputName: goal, outputEmoji: '🎟️', category: 'Finished Creation', explanation: `Seal the printed insert to produce the durable finished ${goal}.` }),
    ],
  };
}

function createWoodcraftPlan(goal: string): CraftingPlan {
  return {
    domain: 'Woodworking',
    sourceMaterials: ['seasoned hardwood', 'wood glue', 'steel fasteners', 'varnish'],
    summary: `Plan: mill the wood, cut fitted parts, assemble and fasten them, sand, then finish the ${goal}.`,
    finalDescription: `${goal} constructed from fitted hardwood parts, proper joinery, surface preparation, and varnish.`,
    steps: [
      makeStep({ toolName: 'cut', inputs: ['seasoned hardwood'], outputName: `Rough-Cut ${goal} Parts`, outputEmoji: '🪵', category: 'Wood Component', explanation: `Cut the hardwood into the main parts required by the ${goal}.` }),
      makeStep({ toolName: 'carve', inputs: [`Rough-Cut ${goal} Parts`], outputName: `Fitted ${goal} Components`, outputEmoji: '🪚', category: 'Wood Component', explanation: 'Shape joints and contact surfaces so the parts fit together.' }),
      makeStep({ toolName: 'assemble', inputs: [`Fitted ${goal} Components`, 'wood glue', 'steel fasteners'], outputName: `Joined ${goal} Assembly`, outputEmoji: '🔨', category: 'Wood Assembly', explanation: 'Join the fitted components with appropriate adhesive and fasteners.' }),
      makeStep({ toolName: 'sand', inputs: [`Joined ${goal} Assembly`], outputName: `Smoothed ${goal} Assembly`, outputEmoji: '🪵', category: 'Wood Assembly', explanation: 'Sand the assembled object only after its joints are secure.' }),
      makeStep({ toolName: 'varnish', inputs: [`Smoothed ${goal} Assembly`, 'varnish'], outputName: goal, outputEmoji: '🪑', category: 'Finished Creation', explanation: `Seal and finish the wood to complete the ${goal}.` }),
    ],
  };
}

function createGenericPlan(goal: string, lower: string): CraftingPlan {
  const soft = includesAny(lower, ['leather', 'bag', 'pouch', 'wallet']);
  const glass = includesAny(lower, ['glass', 'bottle', 'jar', 'vase', 'cup']);

  if (soft) {
    return {
      domain: 'Leatherwork',
      sourceMaterials: ['raw hide', 'plant tannin', 'thread', 'brass fastener', 'dye'],
      summary: `Plan: tan the hide, cut goal-specific panels, prepare the fasteners, stitch the body, then dye and finish the ${goal}.`,
      finalDescription: `${goal} made from tanned hide, fitted panels, stitched seams, and appropriate hardware.`,
      steps: [
        makeStep({ toolName: 'tan', inputs: ['raw hide', 'plant tannin'], outputName: 'Supple Finished Leather', outputEmoji: '🟫', category: 'Leather Material', explanation: 'Tan the raw hide before treating it as a workable craft material.' }),
        makeStep({ toolName: 'cut', inputs: ['Supple Finished Leather'], outputName: `Cut ${goal} Panels`, outputEmoji: '✂️', category: 'Leather Component', explanation: `Cut panels specifically shaped for the ${goal}.` }),
        makeStep({ toolName: 'forge', inputs: ['brass fastener'], outputName: `Fitted ${goal} Hardware`, outputEmoji: '🔘', category: 'Leather Component', explanation: 'Prepare only the buckles, snaps, or closures the item requires.' }),
        makeStep({ toolName: 'stitch', inputs: [`Cut ${goal} Panels`, 'thread', `Fitted ${goal} Hardware`], outputName: `Stitched ${goal} Assembly`, outputEmoji: '🪡', category: 'Leather Assembly', explanation: 'Stitch the panels around the fitted hardware into the requested form.' }),
        makeStep({ toolName: 'infuse', inputs: [`Stitched ${goal} Assembly`, 'dye'], outputName: goal, outputEmoji: '👜', category: 'Finished Creation', explanation: `Apply an even dye and protective finish to complete the ${goal}.` }),
      ],
    };
  }

  if (glass) {
    return {
      domain: 'Glasswork',
      sourceMaterials: ['silica sand', 'soda ash', 'clay mold', 'polishing compound'],
      summary: `Plan: mix and melt a glass batch, form it in a purpose-built mold, anneal it, then polish and inspect the ${goal}.`,
      finalDescription: `${goal} formed from a properly melted glass batch, slowly annealed for strength, and polished clean.`,
      steps: [
        makeStep({ toolName: 'mix', inputs: ['silica sand', 'soda ash'], outputName: 'Prepared Glass Batch', outputEmoji: '⚗️', category: 'Glass Material', explanation: 'Combine silica with a suitable flux before heating it.' }),
        makeStep({ toolName: 'melt', inputs: ['Prepared Glass Batch'], outputName: 'Molten Glass', outputEmoji: '🔥', category: 'Glass Material', explanation: 'Melt the prepared batch until it becomes uniformly workable.' }),
        makeStep({ toolName: 'mold', inputs: ['Molten Glass', 'clay mold'], outputName: `Formed ${goal}`, outputEmoji: '🏺', category: 'Glass Assembly', explanation: `Shape the molten glass in a mold made for the ${goal}.` }),
        makeStep({ toolName: 'anneal', inputs: [`Formed ${goal}`], outputName: `Annealed ${goal}`, outputEmoji: '🏺', category: 'Glass Assembly', explanation: 'Cool the formed glass gradually to relieve internal stress.' }),
        makeStep({ toolName: 'polish', inputs: [`Annealed ${goal}`, 'polishing compound'], outputName: goal, outputEmoji: '🏺', category: 'Finished Creation', explanation: `Smooth the rim and inspect the glass to complete the ${goal}.` }),
      ],
    };
  }

  return {
    domain: 'General fabrication',
    sourceMaterials: ['structural stock', 'joining hardware', 'surface finish'],
    summary: `Plan: prepare a suitable structural material, form goal-specific parts, join them, then finish and inspect the ${goal}.`,
    finalDescription: `${goal} produced from purpose-selected structural stock through forming, fitted assembly, and finishing.`,
    steps: [
      makeStep({ toolName: 'cut', inputs: ['structural stock'], outputName: `Rough ${goal} Components`, outputEmoji: '🧩', category: 'Structural Component', explanation: `Select suitable structural stock and cut the main components required by the ${goal}.` }),
      makeStep({ toolName: 'shape', inputs: [`Rough ${goal} Components`], outputName: `Fitted ${goal} Components`, outputEmoji: '⚙️', category: 'Structural Component', explanation: 'Shape contact surfaces and functional details so the components fit their intended purpose.' }),
      makeStep({ toolName: 'assemble', inputs: [`Fitted ${goal} Components`, 'joining hardware'], outputName: `Assembled ${goal}`, outputEmoji: '🔧', category: 'Functional Assembly', explanation: 'Join the fitted parts with hardware selected for the material and expected load.' }),
      makeStep({ toolName: 'polish', inputs: [`Assembled ${goal}`, 'surface finish'], outputName: goal, outputEmoji: '✨', category: 'Finished Creation', explanation: `Apply the appropriate surface finish, inspect the joints, and complete the ${goal}.` }),
    ],
  };
}

export function createCraftingPlan(rawGoal: string): CraftingPlan {
  const goal = cleanGoal(rawGoal);
  const lower = goal.toLowerCase();

  if (includesAny(lower, ['coffee', 'espresso', 'latte', 'macchiato', 'cappuccino', 'mocha', 'flat white'])) {
    return createCoffeePlan(goal, lower);
  }
  if (includesAny(lower, ['tea', 'matcha', 'chai', 'juice', 'smoothie', 'lemonade', 'cocktail', 'drink'])) {
    return createTeaOrDrinkPlan(goal, lower);
  }
  if (includesAny(lower, ['pizza', 'calzone', 'flatbread'])) return createPizzaPlan(goal, lower);
  if (includesAny(lower, ['cake', 'cupcake', 'cookie', 'brownie', 'pastry', 'donut', 'pie'])) {
    return createBakedDessertPlan(goal, lower);
  }
  if (includesAny(lower, ['ramen', 'noodle', 'burger', 'sandwich', 'soup', 'stew', 'meal', 'dish', 'food'])) {
    return createMealPlan(goal, lower);
  }
  if (includesAny(lower, ['shield', 'armor', 'armour', 'helmet', 'breastplate', 'gauntlet'])) {
    return createArmorPlan(goal, lower);
  }
  if (includesAny(lower, ['sword', 'blade', 'katana', 'saber', 'lightsaber', 'dagger', 'knife', 'axe', 'hammer', 'spear', 'bow', 'crossbow'])) {
    return createWeaponPlan(goal, lower);
  }
  if (includesAny(lower, ['watch', 'clock', 'phone', 'computer', 'robot', 'drone', 'device', 'gadget', 'cyber', 'quantum', 'reactor', 'car', 'truck', 'vehicle', 'rocket', 'shuttle', 'ship'])) {
    return createTechnologyPlan(goal, lower);
  }
  if (includesAny(lower, ['potion', 'elixir', 'tonic', 'draught'])) {
    return createAlchemyPlan(goal, lower);
  }
  if (includesAny(lower, ['wand', 'staff', 'grimoire', 'tome', 'scroll', 'magic', 'arcane', 'enchanted'])) {
    return createMagicPlan(goal, lower);
  }
  if (includesAny(lower, ['ring', 'necklace', 'bracelet', 'earring', 'brooch', 'pendant', 'amulet', 'crown', 'tiara', 'jewelry', 'jewellery'])) {
    return createJewelryPlan(goal, lower);
  }
  if (includesAny(lower, ['book', 'notebook', 'journal', 'manual'])) {
    return createBookPlan(goal);
  }
  if (includesAny(lower, ['shirt', 'coat', 'cloak', 'robe', 'dress', 'pants', 'hat', 'glove', 'boot', 'garment', 'cloth'])) {
    return createTextilePlan(goal, lower);
  }
  if (includesAny(lower, ['pass', 'ticket', 'card', 'badge', 'permit', 'license', 'licence'])) {
    return createPrintedCardPlan(goal);
  }
  if (includesAny(lower, ['wooden', 'table', 'chair', 'shelf', 'cabinet', 'desk', 'chest', 'furniture'])) {
    return createWoodcraftPlan(goal);
  }

  return createGenericPlan(goal, lower);
}

