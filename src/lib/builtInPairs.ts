import { CANONICAL_INFINITE_CRAFT_RECIPES } from './infiniteCraftData.js';
import { CULTURE_RECIPES } from './cultureRecipes.js';
import { TRAIL_RECIPES } from './discoveryTrails.js';
import { PLAYFUL_RECIPES } from './playfulRecipes.js';
/** Shared deterministic precedence: new playful routes never replace existing
 * authored combinations. The server may also resolve legacy Foundry pairs. */
export const BUILT_IN_PAIR_RECIPES:Record<string,{result:string;emoji:string;explanation?:string;connection?:string;category?:string}> = {
  ...PLAYFUL_RECIPES, ...CULTURE_RECIPES, ...TRAIL_RECIPES, ...CANONICAL_INFINITE_CRAFT_RECIPES,
};
