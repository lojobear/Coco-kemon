/** Screen-space hit testing for Craft's freeform drag-and-drop.
 * Intentional overlaps count; merely coming near a pill does not combine it.
 */
export interface CraftRect { left: number; top: number; width: number; height: number }
export interface CraftDropTarget<T> { item: T; rect: CraftRect }
export function intersectionArea(a: CraftRect, b: CraftRect): number {
  const width = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return width * height;
}
export function findCraftDropTarget<T>(
  moving: CraftRect,
  candidates: readonly CraftDropTarget<T>[],
  pointer: { x: number; y: number },
): T | null {
  let selected: T | null = null;
  let best = 0;
  for (const { item, rect } of candidates) {
    if (rect.width <= 0 || rect.height <= 0 || moving.width <= 0 || moving.height <= 0) continue;
    const overlap = intersectionArea(moving, rect) / Math.min(moving.width * moving.height, rect.width * rect.height);
    const pointerInside = pointer.x >= rect.left && pointer.x <= rect.left + rect.width
      && pointer.y >= rect.top && pointer.y <= rect.top + rect.height;
    // Actual overlap—not a magnetic radius. A finger can obscure the dragged pill,
    // so substantial visual overlap also counts on touch.
    if (overlap < 0.23 && !(pointerInside && overlap > 0.06)) continue;
    const score = overlap + (pointerInside ? 0.35 : 0);
    if (score > best) { best = score; selected = item; }
  }
  return selected;
}
