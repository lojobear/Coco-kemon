import { BOARD_WIDTH } from './boardGeometry';
export interface TidyTile { instanceId: string; width: number; height: number; pinned?:boolean;x?:number;y?:number }
export function tidyBoard(tiles: TidyTile[], viewport: { width: number; height: number; left: number; top: number }, initialZoom: number) {
  if(tiles.some(tile=>tile.pinned)){
    const zoom=initialZoom,left=Math.max(0,viewport.left),top=Math.max(0,viewport.top);
    const maxWidth=Math.max(1,...tiles.map(t=>t.width)),rowHeight=Math.max(1,...tiles.map(t=>t.height))+56;
    const columns=Math.max(1,Math.floor((viewport.width/zoom-32+12)/(maxWidth+12)));
    const occupied=tiles.filter(t=>t.pinned).map(t=>({...t,x:t.x||0,y:t.y||0}));
    let cursor=0;
    const positions=tiles.map(tile=>{
      if(tile.pinned)return{instanceId:tile.instanceId,x:tile.x||0,y:tile.y||0};
      for(;;){
        const x=left+16+(cursor%columns)*(maxWidth+12),y=top+16+Math.floor(cursor/columns)*rowHeight;cursor++;
        if(occupied.some(other=>x<other.x+other.width+12&&x+tile.width+12>other.x&&y<other.y+other.height+12&&y+tile.height+12>other.y))continue;
        occupied.push({...tile,x,y});return{instanceId:tile.instanceId,x,y};
      }
    });
    return{zoom,left,top,positions,fits:positions.every((p,i)=>p.x>=left&&p.y>=top&&p.x+tiles[i].width<=left+viewport.width/zoom&&p.y+tiles[i].height<=top+viewport.height/zoom)};
  }
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
