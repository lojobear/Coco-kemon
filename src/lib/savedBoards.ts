import {parseBoardLayout,type SavedBoardTile} from './boardLayout';
import type {InfiniteElement} from './infiniteCraftData';
import {clampBoardZoom} from './boardHistory';
export const MAX_SAVED_BOARDS=12;
export interface CraftBoard {id:string;name:string;tiles:SavedBoardTile[];zoom:number}
export interface SavedBoards {version:1;activeId:string;boards:CraftBoard[]}
export function initialSavedBoards(tiles:SavedBoardTile[]=[],zoom=1):SavedBoards {
 return {version:1,activeId:'main',boards:[{id:'main',name:'Main board',tiles,zoom:clampBoardZoom(zoom)}]};
}
export function parseSavedBoards(value:unknown,collection:readonly InfiniteElement[]):SavedBoards|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Partial<SavedBoards>;
 if(v.version!==1||!Array.isArray(v.boards)||v.boards.length<1||v.boards.length>MAX_SAVED_BOARDS||typeof v.activeId!=='string')return null;
 const ids=new Set<string>();const names=new Set<string>();const boards:CraftBoard[]=[];
 for(const board of v.boards){
  if(!board||typeof board.id!=='string'||!/^[\w-]{1,80}$/.test(board.id)||ids.has(board.id)||typeof board.name!=='string'||!board.name.trim()||board.name.trim().length>32||names.has(board.name.trim().toLowerCase())||typeof board.zoom!=='number'||!Number.isFinite(board.zoom))return null;
  const tiles=parseBoardLayout(board.tiles,collection);if(!tiles)return null;
  ids.add(board.id);names.add(board.name.trim().toLowerCase());boards.push({id:board.id,name:board.name.trim(),tiles,zoom:clampBoardZoom(board.zoom)});
 }
 if(!ids.has(v.activeId))return null;
 return {version:1,activeId:v.activeId,boards};
}
export function nextBoardName(boards:readonly CraftBoard[],base='New board'){
 const names=new Set(boards.map(b=>b.name.toLowerCase()));let name=base.slice(0,32),i=2;
 while(names.has(name.toLowerCase())){const suffix=` ${i++}`;name=base.slice(0,32-suffix.length)+suffix;}
 return name;
}
