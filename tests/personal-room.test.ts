import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyPersonalRooms, validPersonalRooms, sanitizePersonalRooms, roomCell, roomPoint, piecePoint, type RoomPiece } from '../src/lib/personalRoom';
import { STARTER_ELEMENTS } from '../src/lib/infiniteCraftData';
import { emptyEconomy } from '../src/lib/economy';
const water:RoomPiece={id:'w',kind:'sprite',name:'Water',nickname:'Little ripple',variant:'normal',x:4,y:4,size:1,flipped:false};
const layout=()=>{const rooms=emptyPersonalRooms();rooms.rooms[0].pieces=[{...water}];return rooms;};
test('room imports bound complexity, reject invalid coordinates and only retain owned, unlocked pieces',()=>{
 const rooms=layout();assert.ok(validPersonalRooms(rooms));
 for(const patch of [{x:NaN},{x:10},{y:-1},{size:4},{size:Infinity},{surface:'ceiling'},{nickname:'a'.repeat(33)},{id:'a'.repeat(81)}]){const bad=layout();Object.assign(bad.rooms[0].pieces[0],patch);assert.equal(validPersonalRooms(bad),false,JSON.stringify(patch));}
 const crowded=layout();crowded.rooms[0].pieces=Array.from({length:21},(_,i)=>({...water,id:`p${i}`}));assert.equal(validPersonalRooms(crowded),false);
 const duplicates=layout();duplicates.rooms[0].pieces.push({...water});assert.equal(validPersonalRooms(duplicates),false);
 const many=layout();many.rooms=Array.from({length:4},(_,i)=>({id:`r${i}`,name:'x',pieces:[]}));assert.equal(validPersonalRooms(many),false);
 rooms.rooms[0].pieces.push({...water,id:'unknown',name:'Unowned'},{...water,id:'locked-form',variant:'holo'},{...water,id:'decor',kind:'decoration',name:'orbit-lamp'});
 const clean=sanitizePersonalRooms(rooms,STARTER_ELEMENTS,0);assert.equal(clean.rooms[0].pieces.length,2);assert.equal(clean.rooms[0].pieces[1].variant,'normal');
 assert.equal(sanitizePersonalRooms(rooms,STARTER_ELEMENTS,18).rooms[0].pieces.length,3);
 const pedestal={...water,id:'stand',kind:'decoration' as const,name:'display-stand'};assert.ok(piecePoint(water,[water,pedestal]).top<piecePoint(water).top);
 for(let x=0;x<=8;x++)for(let y=0;y<=8;y++){const p=roomPoint(x,y);assert.deepEqual(roomCell(p.left,p.top),{x,y});}
});
test('rooms commit durably, survive crafting, backup restore and room switching; failed commits preserve last room',async()=>{
 const values=new Map<string,string>();Object.assign(globalThis,{window:new EventTarget(),localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
 const {pathToFileURL}=await import('node:url'),path=await import('node:path');
 const session=await import(pathToFileURL(path.resolve('src/lib/saveData.ts')).href+'?personal-rooms');
 const foundry={materials:[],oddkinCollection:[],processes:[],experiments:[],habitats:[]};
 let disk:any={revision:1,envelope:{version:3,savedAt:1,foundry,crafting:STARTER_ELEMENTS,economy:emptyEconomy()}},fail=false;
 const db={read:async()=>structuredClone(disk),commit:async(envelope:any,revision:number)=>{assert.equal(revision,disk.revision);if(fail)throw new Error('Disk full');disk={revision:revision+1,envelope:structuredClone(envelope)};return structuredClone(disk);},close(){}};
 await session.initializeLocalSave(async()=>db);
 const onShelf=layout();onShelf.rooms[0].pieces[0].surface='left-shelf';await session.commitPersonalRooms(onShelf);assert.equal(session.readPersonalRooms().rooms[0].pieces[0].surface,'left-shelf');
 await session.commitPersonalRooms(layout());assert.equal(session.readPersonalRooms().rooms[0].pieces[0].nickname,'Little ripple');
 const backup=session.exportCompleteSave(foundry);assert.deepEqual(session.parseSave(backup).personalRooms,layout());
 session.saveCraftElements([...STARTER_ELEMENTS,{id:'steam',name:'Steam',emoji:'s'}]);await session.waitForLocalSave();assert.deepEqual(session.readPersonalRooms(),layout());
 const changed=layout();changed.rooms.push({id:'room2',name:'Second room',pieces:[]});changed.activeId='room2';await session.commitPersonalRooms(changed);assert.equal(session.readPersonalRooms().activeId,'room2');
 fail=true;const before=JSON.stringify(disk);await assert.rejects(session.commitPersonalRooms(layout()),/Disk full/);assert.equal(JSON.stringify(disk),before);assert.equal(session.readPersonalRooms().activeId,'room2');
 fail=false;await session.importCompleteSaveDurably(backup);assert.deepEqual(session.readPersonalRooms(),layout());
 const invalid=layout();invalid.rooms[0].pieces[0].name='Not owned';await assert.rejects(session.commitPersonalRooms(invalid),/not in your collection/);
 const walletBefore=structuredClone(session.readEconomy());await session.commitPersonalRooms(layout());assert.deepEqual(session.readEconomy(),walletBefore);
 const legacy=JSON.parse(backup);delete legacy.personalRooms;await session.importCompleteSaveDurably(JSON.stringify(legacy));assert.deepEqual(session.readPersonalRooms(),emptyPersonalRooms());
});
