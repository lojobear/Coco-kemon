/**
 * Undo affects placement only, never the actual player's discoveries.
 * Immutable snapshots make drag, tidy, clear and merge actions reversible.
 */
export interface BoardHistory<T> {
  past: T[][];
  present: T[];
  future: T[][];
}
export const MAX_BOARD_UNDO = 30;
export function beginBoardHistory<T>(items: T[]): BoardHistory<T> {
  return {past:[],present:items,future:[]};
}
export function recordBoardHistory<T>(history:BoardHistory<T>, items:T[]):BoardHistory<T> {
  if(history.present===items)return history;
  return {past:[...history.past,history.present].slice(-MAX_BOARD_UNDO),present:items,future:[]};
}
export function undoBoard<T>(history:BoardHistory<T>):BoardHistory<T> {
  if(!history.past.length)return history;
  return {past:history.past.slice(0,-1),present:history.past[history.past.length-1],future:[history.present,...history.future].slice(0,MAX_BOARD_UNDO)};
}
export function redoBoard<T>(history:BoardHistory<T>):BoardHistory<T> {
  if(!history.future.length)return history;
  return {past:[...history.past,history.present].slice(-MAX_BOARD_UNDO),present:history.future[0],future:history.future.slice(1)};
}
export function clampBoardZoom(zoom:number):number {
  return Math.round(Math.max(0.6,Math.min(1.5,zoom))*100)/100;
}
