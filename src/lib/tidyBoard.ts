import { BOARD_WIDTH } from './boardGeometry';
export interface TidyTile { instanceId: string; width: number; height: number }
export function tidyBoard(tiles: TidyTile[], viewport: { width: number; height: number; left: number; top: number }, initialZoom: number) {
  const width = Math.max(1, ...tiles.map(tile => tile.width));
  const pack = (zoom: number) => {
    const columns = Math.max(1, Math.floor((viewport.width / zoom - 32 + 12) / (width + 12)));
    const rows: { y: number; height: number }[] = [];
    let bottom = 16;
    for (let i = 0; i < tiles.length; i += columns) {
      const height = Math.max(...tiles.slice(i, i + columns).map(tile => tile.height));
      rows.push({ y: bottom, height });
      bottom += height + 56;
    }
    return { columns, rows, height: tiles.length ? bottom - 56 + 16 : 0 };
  };
  let zoom = initialZoom;
  let grid = pack(zoom);
  while (zoom > .6 && grid.height * zoom > viewport.height) {
    zoom = Math.max(.6, Math.round((zoom - .05) * 100) / 100);
    grid = pack(zoom);
  }
  const left = Math.max(0, Math.min(BOARD_WIDTH - viewport.width / zoom, viewport.left));
  const top = Math.max(0, viewport.top);
  return { zoom, fits: grid.height * zoom <= viewport.height, left, top,
    positions: tiles.map((tile, index) => ({ instanceId: tile.instanceId,
      x: left + 16 + index % grid.columns * (width + 12),
      y: top + grid.rows[Math.floor(index / grid.columns)].y })) };
}
