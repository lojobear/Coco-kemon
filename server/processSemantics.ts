import type { Process } from '../src/types.js';

const MARKER = 'PROCESS CONTRACT DATA: ';
export function processContract(process: Process, inputs: string[]): string {
  return `${MARKER}${JSON.stringify({ processId: process.id, inputs })}
PROCESS CONTRACT:
- Selected action: ${process.name}. Meaning: ${process.verb}. ${process.description}
- Apply this action to the ingredients together. Every supplied ingredient must contribute a specific material, function, flavor, structure, character or cultural association.
- Contrast test: compare with Mix and with an opposing action. A Freeze result must be caused by cooling; it cannot be the heated or fermented result just renamed. Related actions may share a result when their actual effects justify it.
- Never silently ignore the second ingredient, even if a familiar unary recipe exists. Never return either unchanged parent as a new discovery.
- Prefer a recognizable transformation. An ordinary result such as Raisin is better than a random rare item or a decorative adjective. Fantasy actions must grant a specific function tied to the parents.
- If there is no meaningful transformation, return no_reaction with a concise observation explaining why this action does not change these inputs. Do not fabricate filler to avoid a failed experiment.
- Alongside the result, include recipeCheck: {"processId":"${process.id}","contributions":[{"input":"exact input name","contribution":"short factual role in the result"}],"processEffect":"short player-facing description of the selected action's effect"}. Include one contribution per supplied ingredient, including repeated ingredients. This is a concise recipe explanation, never private reasoning.`;
}

/** Structural guard, not a proof of AI semantics. Reject missing ingredients/actions before caching. */
export function acceptProcessResponse(raw: string, prompt: string): string | null {
  const line = prompt.split('\n').find(line => line.startsWith(MARKER));
  if (!line) return raw; // Older callers do not request the contract.
  try {
    const contract = JSON.parse(line.slice(MARKER.length));
    const parsed = JSON.parse(raw);
    const shortText = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
    if (parsed?.status === 'no_reaction') return shortText(parsed.explanation) ? raw : null;
    if (parsed?.status !== 'new_material' && parsed?.status !== 'life_emergence') return null;
    const check = parsed.recipeCheck;
    if (check?.processId !== contract.processId || !shortText(check.processEffect) || !Array.isArray(check.contributions)) return null;
    const names = contract.inputs.map((s: string) => s.trim().toLowerCase()).sort();
    if (check.contributions.length !== names.length || !check.contributions.every((c: any) => shortText(c?.input) && shortText(c?.contribution))) return null;
    const supplied = check.contributions.map((c: any) => c.input.trim().toLowerCase()).sort();
    if (!names.every((name: string, i: number) => name === supplied[i])) return null;
    const result = parsed.status === 'life_emergence' ? parsed.oddkin?.speciesName : parsed.material?.displayName;
    if (!shortText(result) || names.includes(result.trim().toLowerCase())) return null;
    return raw;
  } catch { return null; }
}
