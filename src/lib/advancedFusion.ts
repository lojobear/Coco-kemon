/**
 * Advanced 3-4 item fusion composed entirely from the existing shared pair
 * recipe catalog and the player's saved, validated recipe history.
 * No network requests, model calls, or image generation in this module.
 */
import { CANONICAL_INFINITE_CRAFT_RECIPES, makePairKey, validNewElementName, type InfiniteElement } from './infiniteCraftData';
import { discoveryIdentity } from './unifiedCollection';
import { applySharedPairDiscovery, type SharedPairRolls } from './sharedCraftingEngine';

export interface FusionStep {
  first:string;
  second:string;
  result:string;
  emoji:string;
}
export interface FusionPlan {
  ingredients: string[];
  steps: FusionStep[];
  result: string;
  emoji: string;
}

function knownRecipes(elements: readonly InfiniteElement[]) {
  const recipes = new Map<string, {result:string;emoji:string}>();
  // Canonical results always win over inconsistent legacy history.
  for (const [key,value] of Object.entries(CANONICAL_INFINITE_CRAFT_RECIPES)) {
    if (validNewElementName(value.result)) recipes.set(key,value);
  }
  for (const item of elements) {
    if (!item?.name || !validNewElementName(item.name) || !item.emoji) continue;
    const recipesForItem = [
      ...(item.recipeHistory || []),
      ...(item.recipe ? [item.recipe] : []),
    ];
    for (const recipe of recipesForItem) {
      if (!recipe?.first || !recipe?.second) continue;
      const key=makePairKey(recipe.first,recipe.second);
      if (!recipes.has(key)) recipes.set(key,{result:item.name,emoji:item.emoji});
    }
  }
  return recipes;
}

/** Choose a discoverable outcome from known two-item steps. Explore all
 * pairings, not just left-to-right; favour a final element not yet owned.
 * No invented recipes or AI calls. All input names must already be owned. */
export function planAdvancedFusion(
  selected: readonly string[],
  elements: readonly InfiniteElement[],
): FusionPlan | null {
  if (selected.length!==3 && selected.length!==4) return null;
  const owned = new Map(elements.filter(e=>e?.name).map(e=>[discoveryIdentity(e.name),e]));
  const nodes = selected.map(name=>owned.get(discoveryIdentity(name)));
  if (nodes.some(item=>!item)) return null;
  const recipes=knownRecipes(elements);
  const plans:FusionPlan[]=[];
  const visit=(items:{name:string;emoji:string}[],steps:FusionStep[])=>{
    if(items.length===1){
      plans.push({ingredients:selected.map(name=>owned.get(discoveryIdentity(name))!.name),
        steps,result:items[0].name,emoji:items[0].emoji});
      return;
    }
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const found=recipes.get(makePairKey(items[i].name,items[j].name));
      if(!found)continue;
      const next=items.filter((_,index)=>index!==i&&index!==j).concat({name:found.result,emoji:found.emoji});
      visit(next,[...steps,{first:items[i].name,second:items[j].name,...found}]);
    }
  };
  visit(nodes as {name:string;emoji:string}[],[]);
  if(!plans.length)return null;
  // Novel final discoveries matter most; preserve deterministic search order
  // for equal scores and do not claim global "first" status.
  return plans.sort((a,b)=>
    Number(!owned.has(discoveryIdentity(b.result)))-Number(!owned.has(discoveryIdentity(a.result))))[0];
}

/** Apply a verified known chain via the SAME rarity/recipe ledger as Craft
 * and Foundry MIX. Rolls are supplied so callers don't randomize in React's
 * state-updater callbacks. No new save format or network call. */
export function applyAdvancedFusion(
  existing: readonly InfiniteElement[],
  plan: FusionPlan,
  rolls: readonly SharedPairRolls[],
  at=Date.now(),
): {elements:InfiniteElement[]; final:InfiniteElement; newDiscoveries:number} {
  if (rolls.length!==plan.steps.length || plan.steps.length<2 || plan.steps.length>3) {
    throw new Error('Invalid advanced fusion chain.');
  }
  let elements=[...existing],final:InfiniteElement|undefined,newDiscoveries=0;
  for(let i=0;i<plan.steps.length;i++){
    const step=plan.steps[i];
    const applied=applySharedPairDiscovery(elements,{
      result:step.result,emoji:step.emoji,isNew:false,
      connection:'advanced fusion',explanation:'A multi-step fusion of known recipes.',
    },step.first,step.second,rolls[i],at+i);
    elements=applied.elements;
    final=applied.main;
    if(applied.isNew)newDiscoveries++;
  }
  return {elements,final:final!,newDiscoveries};
}
