/**
 * Collision thresholds for the draggable freeform crafting board.
 * Positions are the same board-local top-left coordinates used by canvas items.
 */
export const MAGNET_PREVIEW_RADIUS = 132;
export const MAGNET_SNAP_RADIUS_MOUSE = 74;
export const MAGNET_SNAP_RADIUS_TOUCH = 88;
export const MAGNET_MIN_DRAG_TRAVEL = 16;

export interface MagneticItem {
  instanceId: string;
  x: number;
  y: number;
}

export function nearestMagneticItem<T extends MagneticItem>(
  items: readonly T[],
  movingId: string,
  x: number,
  y: number,
  radius: number,
): { item: T; distance: number } | null {
  let nearest: { item: T; distance: number } | null = null;
  for (const item of items) {
    if (item.instanceId === movingId) continue;
    const distance = Math.hypot(item.x - x, item.y - y);
    if (distance <= radius && (!nearest || distance < nearest.distance)) {
      nearest = { item, distance };
    }
  }
  return nearest;
}

/**
 * When two items start close together, they must move *toward* each other.
 * This prevents a small accidental swipe away from auto-combining them.
 */
export function shouldMagnetSnap(
  travel: number,
  currentDistance: number,
  startingDistance: number,
  snapRadius: number,
): boolean {
  return travel >= MAGNET_MIN_DRAG_TRAVEL
    && currentDistance <= snapRadius
    && currentDistance <= startingDistance - 8;
}
