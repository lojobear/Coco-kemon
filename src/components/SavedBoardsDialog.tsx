import {useEffect,useRef,useState} from 'react';
import {MAX_SAVED_BOARDS,nextBoardName,type SavedBoards} from '../lib/savedBoards';
export function SavedBoardsDialog({value,onChange,onClose}:{value:SavedBoards;onChange:(next:SavedBoards)=>Promise<void>;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const active=value.boards.find(b=>b.id===value.activeId)!;
 const [name,setName]=useState(active.name),[newName,setNewName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{setName(active.name);setConfirmDelete(false);},[active.id,active.name]);
 useEffect(()=>{const back=()=>{if(!busy)onClose();};window.addEventListener('boop-native-back',back);return()=>window.removeEventListener('boop-native-back',back);},[busy,onClose]);
 const apply=async(next:SavedBoards)=>{setError('');setBusy(true);try{await onChange(next);return true;}catch(e){setError(e instanceof Error?e.message:'Could not save boards. Please try again.');return false;}finally{setBusy(false);}};
 const validName=(raw:string)=>{const trimmed=raw.trim();if(!trimmed||trimmed.length>32){setError('Choose a board name up to 32 characters.');return null;}if(value.boards.some(b=>b.id!==active.id&&b.name.toLowerCase()===trimmed.toLowerCase())){setError('Another board already uses that name.');return null;}return trimmed;};
 return <dialog ref={dialog} className="saved-boards-dialog" aria-labelledby="saved-boards-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}} onClose={()=>{if(!busy)onClose();}}>
  <header><div><h2 id="saved-boards-title">Your boards</h2><p>Separate experiments. Shared discoveries. Saved automatically.</p></div><button disabled={busy} aria-label="Close boards" onClick={onClose}>✕</button></header>
  {error&&<p role="alert">{error}</p>}
  <div className="saved-board-list" role="group" aria-label="Saved boards">{value.boards.map(board=><button key={board.id} disabled={busy} aria-pressed={board.id===value.activeId} onClick={()=>void apply({...value,activeId:board.id})}>
    <strong>{board.name}</strong><small>{board.tiles.length} elements · {board.tiles.filter(t=>t.pinned).length} pinned{board.id===value.activeId?' · Current':''}</small>
  </button>)}</div>
  <form onSubmit={e=>{e.preventDefault();const valid=validName(name);if(valid)void apply({...value,boards:value.boards.map(b=>b.id===active.id?{...b,name:valid}:b)});}}>
   <label htmlFor="saved-board-name">Current board name</label><div><input id="saved-board-name" value={name} maxLength={32} disabled={busy} onChange={e=>setName(e.target.value)}/><button disabled={busy||name.trim()===active.name}>Save name</button></div>
  </form>
  <form onSubmit={e=>{e.preventDefault();if(value.boards.length>=MAX_SAVED_BOARDS)return;const boardName=newName.trim()||nextBoardName(value.boards);if(value.boards.some(b=>b.name.toLowerCase()===boardName.toLowerCase())){setError('Another board already uses that name.');return;}const id=crypto.randomUUID();void apply({...value,activeId:id,boards:[...value.boards,{id,name:boardName,tiles:[],zoom:1}]}).then(saved=>{if(saved)setNewName('');});}}>
   <label htmlFor="new-board-name">New board name</label><div><input id="new-board-name" value={newName} maxLength={32} placeholder="Cooking, Science, Nature…" disabled={busy||value.boards.length>=MAX_SAVED_BOARDS} onChange={e=>setNewName(e.target.value)}/><button disabled={busy||value.boards.length>=MAX_SAVED_BOARDS}>Create board</button></div><small>New boards start empty. Add any element you already own.</small>
  </form>
  <div className="saved-board-actions"><button disabled={busy||value.boards.length>=MAX_SAVED_BOARDS} onClick={()=>{const id=crypto.randomUUID();void apply({...value,activeId:id,boards:[...value.boards,{...active,id,name:nextBoardName(value.boards,active.name+' copy'),tiles:active.tiles.map(t=>({...t}))}]});}}>Duplicate current board</button><button disabled={busy||value.boards.length<2} onClick={()=>setConfirmDelete(true)}>Delete current board</button></div>
  {confirmDelete&&<div className="saved-board-delete"><p>Delete “{active.name}” and its layout? Your discoveries and other boards stay saved.</p><button disabled={busy} onClick={()=>{const boards=value.boards.filter(b=>b.id!==active.id);void apply({...value,activeId:boards[0].id,boards});}}>Confirm delete board</button><button disabled={busy} onClick={()=>setConfirmDelete(false)}>Cancel</button></div>}
  <p className="saved-boards-footer" role="status">{busy?'Saving boards…':`${value.boards.length} / ${MAX_SAVED_BOARDS} boards · Included in exports and cloud saves`}</p>
 </dialog>;
}
