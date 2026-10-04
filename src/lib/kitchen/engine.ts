import type { CraftingPlan, PlannedCraftingStep } from './originalPlanner';
import type { InfiniteElement } from '../infiniteCraftData';
export type KitchenRecipe = CraftingPlan & { goal: string; source: 'local' | 'ai'; createdAt: number };
const key = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const short = (v: unknown, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export function validKitchenPlan(value: unknown): value is CraftingPlan {
  const p = value as CraftingPlan;
  if (!p || !short(p.domain) || !short(p.summary, 1200) || !short(p.finalDescription, 1200) || !Array.isArray(p.sourceMaterials) || p.sourceMaterials.length > 40 || !p.sourceMaterials.every(v => short(v)) || !Array.isArray(p.steps) || p.steps.length < 1 || p.steps.length > 32) return false;
  const available = new Set(p.sourceMaterials.map(key));
  for (const s of p.steps) {
    if (!s || !short(s.toolName, 60) || !/^[a-z][a-z0-9_]*$/i.test(s.toolName) || !short(s.outputName) || !short(s.outputEmoji, 24) || !short(s.category) || !short(s.explanation, 1200) || !Array.isArray(s.inputs) || !s.inputs.length || s.inputs.length > 12 || !s.inputs.every(v => short(v) && available.has(key(v)))) return false;
    if (available.has(key(s.outputName))) return false;
    available.add(key(s.outputName));
  }
  return true;
}
export function validKitchenRecipe(value: unknown): value is KitchenRecipe {
  const r = value as KitchenRecipe;
  return validKitchenPlan(value) && short(r.goal) && ['local','ai'].includes(r.source) && Number.isFinite(r.createdAt);
}
export function runKitchenStep(step: PlannedCraftingStep, available: Set<string>): Set<string> {
  if (!step.inputs.every(input => available.has(key(input)))) throw new Error('This step requires an earlier ingredient. Complete the preceding steps first.');
  return new Set([...available, key(step.outputName)]);
}
export function sourceInventory(plan: CraftingPlan) { return new Set(plan.sourceMaterials.map(key)); }
export function collectKitchenStep(elements: InfiniteElement[], step: PlannedCraftingStep, recipe?: KitchenRecipe): InfiniteElement[] {
  const existing = elements.find(el => key(el.name) === key(step.outputName));
  if (existing) return recipe ? elements.map(el => el.id === existing.id ? { ...el, kitchenRecipe: recipe } : el) : elements;
  const element: InfiniteElement = {
    id: `kitchen:${encodeURIComponent(key(step.outputName))}`, name: step.outputName, emoji: step.outputEmoji,
    explanation: step.explanation.slice(0, 280), connection: 'kitchen', discoveredAt: Date.now(), isNew: true,
    ...(recipe ? { kitchenRecipe: recipe } : {}),
  };
  return [...elements, element];
}
