/** Exact game recipes: the action is part of the identity, never inferred from a category. */
export interface ProcessRecipe { processId: string; inputs: string[]; result: string; emoji: string; explanation: string; connection: string }
type RecipeRow = [processId: string, inputs: string[], result: string, emoji: string, explanation: string];
const rows: RecipeRow[] = [
  ['HEAT', ['Milk'], 'Hot Milk', '🥛', 'Heat warms Milk into Hot Milk.'],
  ['FREEZE', ['Milk'], 'Frozen Milk', '🧊', 'Freeze solidifies Milk into Frozen Milk.'],
  ['FERMENT', ['Milk'], 'Yogurt', '🥣', 'Ferment cultures Milk into Yogurt.'],
  ['DRY', ['Milk'], 'Milk Powder', '🥛', 'Dry removes water from Milk, leaving Milk Powder.'],
  ['HEAT', ['Grape'], 'Grape Jam', '🍇', 'Heat cooks down Grape into Grape Jam.'],
  ['FREEZE', ['Grape'], 'Frozen Grape', '🧊', 'Freeze turns Grape into a Frozen Grape snack.'],
  ['FERMENT', ['Grape'], 'Wine', '🍷', 'Ferment transforms the sugars in Grape into Wine.'],
  ['DRY', ['Grape'], 'Raisin', '🍇', 'Dry removes moisture from Grape to make a Raisin.'],
  ['HEAT', ['Apple'], 'Baked Apple', '🍎', 'Heat softens and cooks Apple into Baked Apple.'],
  ['CRUSH', ['Apple'], 'Applesauce', '🍎', 'Crush breaks Apple into Applesauce.'],
  ['FERMENT', ['Apple'], 'Cider', '🍺', 'Ferment transforms Apple sugars into Cider.'],
  ['DRY', ['Apple'], 'Apple Chips', '🍎', 'Dry removes moisture from thin Apple pieces to make Apple Chips.'],
  ['CRUSH', ['Clay'], 'Clay Powder', '🪨', 'Crush breaks dry Clay into Clay Powder.'],
  ['SOAK', ['Clay'], 'Clay Slip', '💧', 'Soak suspends Clay in water to form Clay Slip.'],
  ['ENCHANT', ['Mirror'], 'Magic Mirror', '🪞', 'Enchant gives Mirror the magical ability to answer questions: Magic Mirror.'],
  ['CRUSH', ['Mirror'], 'Broken Mirror', '🪞', 'Crush shatters Mirror into a Broken Mirror.'],
  ['FOSSILIZE', ['Wood'], 'Petrified Wood', '🪵', 'Fossilize replaces Wood tissue with minerals while preserving its grain: Petrified Wood.'],
  ['CRUSH', ['Wood'], 'Sawdust', '🪵', 'Crush breaks Wood into small particles of Sawdust.'],
  ['ENCHANT', ['Wood'], 'Magic Wand', '🪄', 'Enchant gives Wood a spellcasting purpose as a Magic Wand.'],
  ['HEAT', ['Milk', 'Chocolate'], 'Hot Chocolate', '☕', 'Heat melts Chocolate into Milk to make Hot Chocolate.'],
  ['FREEZE', ['Milk', 'Chocolate'], 'Chocolate Ice Cream', '🍨', 'Freeze sets Milk and Chocolate into Chocolate Ice Cream in Boop.'],
  ['HEAT', ['Water', 'Tea'], 'Brewed Tea', '🍵', 'Heat draws flavor from Tea into Water, making Brewed Tea.'],
  ['FREEZE', ['Water', 'Tea'], 'Tea Ice Cubes', '🧊', 'Freeze locks Tea and Water together into Tea Ice Cubes.'],
  ['HEAT', ['Apple', 'Sugar'], 'Caramel Apple', '🍎', 'Heat caramelizes Sugar around Apple to make a Caramel Apple.'],
  ['FERMENT', ['Apple', 'Sugar'], 'Apple Wine', '🍷', 'Ferment transforms Apple and added Sugar into Apple Wine.'],
  ['HEAT', ['Water', 'Coffee'], 'Brewed Coffee', '☕', 'Heat draws flavor from Coffee into Water, making Brewed Coffee.'],
  ['FREEZE', ['Water', 'Coffee'], 'Coffee Ice Cubes', '🧊', 'Freeze locks Coffee and Water together into Coffee Ice Cubes.'],
];
export const PROCESS_RECIPES: ProcessRecipe[] = rows.map(([processId, inputs, result, emoji, explanation]) => ({
  processId, inputs, result, emoji, explanation, connection: 'transformation',
}));
const normalize = (name: string) => name.trim().toLocaleUpperCase('en-US');
export function findProcessRecipe(processId: string, inputs: readonly string[]): ProcessRecipe | undefined {
  const names = inputs.map(normalize).sort();
  return PROCESS_RECIPES.find(recipe => recipe.processId === processId && recipe.inputs.length === names.length &&
    recipe.inputs.map(normalize).sort().every((name, i) => name === names[i]));
}
