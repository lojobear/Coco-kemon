import test from 'node:test';import assert from 'node:assert/strict';
import {initialSavedBoards,parseSavedBoards,nextBoardName,MAX_SAVED_BOARDS} from '../src/lib/savedBoards';
const collection=[{id:'water',name:'Water',emoji:'💧'},{id:'fire',name:'Fire',emoji:'🔥'}];
test('saved boards preserve separate layouts and pins without introducing unowned elements',()=>{
 const state=initialSavedBoards([{instanceId:'water',name:'Water',emoji:'wrong',x:980,y:700,pinned:true}],1.2);
 state.boards.push({id:'science',name:'Science',zoom:.8,tiles:[{instanceId:'fire',name:'Fire',emoji:'wrong',x:1300,y:900},{instanceId:'not-owned',name:'Dragon',emoji:'🐉',x:0,y:0}]});state.activeId='science';
 const parsed=parseSavedBoards(JSON.parse(JSON.stringify(state)),collection)!;assert.equal(parsed.activeId,'science');assert.equal(parsed.boards[0].tiles[0].pinned,true);assert.equal(parsed.boards[0].zoom,1.2);assert.equal(parsed.boards[1].tiles.length,1);assert.equal(parsed.boards[1].tiles[0].emoji,'🔥');assert.equal(parsed.boards[1].tiles[0].x,1300);
 assert.equal(nextBoardName(parsed.boards,'Science'),'Science 2');assert.equal(MAX_SAVED_BOARDS,12);
});
test('malformed, duplicate or unsupported board sets cannot replace saved work',()=>{
 const state=initialSavedBoards();
 for(const bad of [{...state,version:2},{...state,activeId:'missing'},{...state,boards:[]},{...state,boards:Array(13).fill(state.boards[0])},{...state,boards:[...state.boards,{...state.boards[0],id:'other',name:'MAIN BOARD'}]},{...state,boards:[{...state.boards[0],name:'x'.repeat(33)}]}])assert.equal(parseSavedBoards(bad,collection),null);
});

test('board changes commit durably, survive crafting and exports, and roll back on database failure',async()=>{
 const values=new Map<string,string>();Object.assign(globalThis,{window:new EventTarget(),localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
 const {pathToFileURL}=await import('node:url');const path=await import('node:path');
 const session=await import(pathToFileURL(path.resolve('src/lib/saveData.ts')).href+'?saved-boards-durable');
 const foundry={materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]};
 let saved:any={revision:1,envelope:{version:3,savedAt:1,foundry,crafting:collection,economy:{version:1,coins:0,sold:{}},boardLayout:[{instanceId:'old-pin',name:'Water',emoji:'💧',x:1100,y:850,pinned:true}]}};let fail=false;
 const db={read:async()=>structuredClone(saved),commit:async(envelope:any,expected:number)=>{assert.equal(expected,saved.revision);if(fail)throw new Error('Disk full');saved={revision:expected+1,envelope:structuredClone(envelope)};return structuredClone(saved);},close(){}};
 await session.initializeLocalSave(async()=>db);
 assert.equal(session.readSavedBoards()?.boards[0].tiles[0].pinned,true);assert.equal(session.readSavedBoards()?.boards[0].tiles[0].x,1100);
 const boards=initialSavedBoards([{instanceId:'water',name:'Water',emoji:'💧',x:980,y:700,pinned:true}]);boards.boards.push({id:'cooking',name:'Cooking',zoom:.8,tiles:[]});boards.activeId='cooking';
 await session.commitSavedBoards(boards);assert.equal(saved.envelope.savedBoards.boards.length,2);
 session.saveCraftElements([...collection,{id:'tea',name:'Tea',emoji:'🍵',discoveredAt:2}]);await session.waitForLocalSave();assert.equal(session.readSavedBoards()?.boards[0].tiles[0].pinned,true);
 const exported=session.exportCompleteSave(foundry);assert.equal(session.parseSave(exported).savedBoards?.activeId,'cooking');
 const prior=JSON.stringify(saved);fail=true;await assert.rejects(session.commitSavedBoards({...boards,boards:boards.boards.map(b=>({...b,name:b.name+' changed'}))}),/Disk full/);assert.equal(JSON.stringify(saved),prior);assert.equal(session.readSavedBoards()?.boards[0].name,'Main board');
 fail=false;await session.importCompleteSaveDurably(JSON.stringify({version:3,foundry,crafting:collection,economy:{version:1,coins:0,sold:{}},boardLayout:[]}));assert.equal(session.readSavedBoards()?.boards.length,1);assert.equal(session.readSavedBoards()?.boards[0].tiles.length,0);
});
