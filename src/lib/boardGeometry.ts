/** Scrollable 2D world for a touch-first Infinite Craft style canvas. */
export const BOARD_WIDTH = 2800;
export const BOARD_HEIGHT = 2200;
export const BOARD_START_X = 980;
export const BOARD_START_Y = 700;

/** Map a visible viewport position to persistent world coordinates. */
export function boardCenter(scrollLeft: number, scrollTop: number, clientWidth: number, clientHeight: number) {
  return { x: scrollLeft + clientWidth / 2, y: scrollTop + clientHeight / 2 };
}
export function clampBoardTile(x: number, y: number) {
  return { x: Math.max(8, Math.min(BOARD_WIDTH - 160, x)),
    y: Math.max(8, Math.min(BOARD_HEIGHT - 65, y)) };
}
