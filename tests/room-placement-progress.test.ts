import test from 'node:test';
import assert from 'node:assert/strict';
import { pieceDepth, piecePoint, pieceWidth, emptyPersonalRooms, sanitizePersonalRooms, validPersonalRooms, type RoomPiece } from '../src/lib/personalRoom';
import { floorCellOpen, nearestRoomPlacement, placementOpen, placementsFor, snapRoomPlacement, tidyRoomPieces } from '../src/lib/roomPlacement';
import { ROOM_STYLES, ROOM_REWARDS, roomDiscoveryProgress, roomRewardUnlocked } from '../src/lib/roomProgress';
import { nextRoomDiscovery } from '../src/lib/roomDiscoveryGoals';
import { STARTER_ELEMENTS, type InfiniteElement, makePairKey } from '../src/lib/infiniteCraftData';
import { BUILT_IN_PAIR_RECIPES } from '../src/lib/builtInPairs';
const sprite=(id:string,x=4,y=4):RoomPiece=>({id,kind:'sprite',name:'Water',nickname:'',variant:'normal',size:1,flipped:false,x,y});
const discovery=(name:string):InfiniteElement=>({id:name.toLowerCase(),name,emoji:'x',discoveredAt:Date.now(),recipe:{first:'Water',second:'Fire'}});
test('the empty floor allows all 81 cells and placement still protects bounds and occupied spots',()=>{
 const p=sprite('one');assert.equal(floorCellOpen(-1,0),false);assert.equal(floorCellOpen(0,0),true);assert.equal(floorCellOpen(8,8),true);
 assert.equal(placementsFor(p,'floor').length,81);
 assert.equal(placementOpen(p,{x:0,y:8},[]),true);
 assert.equal(placementOpen(p,{x:8,y:0},[]),true);
 assert.equal(snapRoomPlacement(p,0,0,[]),null);assert.equal(snapRoomPlacement(p,100,100,[]),null);
 const onShelf=snapRoomPlacement(p,29,29.8,[]);assert.equal(onShelf?.surface,'left-shelf');assert.equal(onShelf?.slot,0);
 const a={...p,...onShelf},b={...sprite('two'),surface:'left-shelf' as const,slot:1};
 assert.equal(placementOpen(sprite('three'),onShelf!,[a,b]),false);assert.equal(nearestRoomPlacement(sprite('three'),'left-shelf',[a,b]),null);
 assert.equal(placementOpen(sprite('two'),p,[p]),false);
 const stand={...sprite('stand'),kind:'decoration' as const,name:'display-stand'};
 assert.equal(placementOpen(p,p,[stand]),true);assert.equal(placementOpen(sprite('two'),p,[stand,p]),false);
 assert.ok(piecePoint(p,[stand]).top<piecePoint(p).top);assert.ok(pieceDepth(p)>pieceDepth(stand));
 assert.ok(pieceWidth({...p,surface:'left-shelf'})<pieceWidth(p));
 const aquarium={...stand,name:'aquarium'};assert.equal(placementsFor(aquarium,'left-shelf').length,0);
 for(const at of placementsFor(p,'floor'))assert.ok(floorCellOpen(at.x,at.y));
});
test('room unlocks use distinct earned discoveries and retain original reputation unlocks',()=>{
 assert.equal(roomDiscoveryProgress(STARTER_ELEMENTS).count,0);const five=['Steam','Mud','Wave','Lava','Stone'].map(discovery);
 assert.equal(roomDiscoveryProgress([...five,...five,discovery('Water')]).count,5);
 assert.equal(ROOM_STYLES.find(s=>s.id==='sunlit')!.discoveries,5);
 for(const id of ['fern','orbit-lamp']){const r=ROOM_REWARDS.find(d=>d.id===id)!;assert.equal(roomRewardUnlocked(r,STARTER_ELEMENTS,0),false);assert.equal(roomRewardUnlocked(r,STARTER_ELEMENTS,18),true);}
 assert.equal(roomRewardUnlocked(ROOM_REWARDS.find(d=>d.id==='terrarium')!,[discovery('Tree')],0),true);
 assert.equal(roomRewardUnlocked(ROOM_REWARDS.find(d=>d.id==='aquarium')!,[discovery('Ocean')],0),true);
 const rooms=emptyPersonalRooms();rooms.rooms[0].style='sunlit';assert.ok(validPersonalRooms(rooms));
 assert.equal(sanitizePersonalRooms(rooms,STARTER_ELEMENTS,0).rooms[0].style,'moonlit');assert.equal(sanitizePersonalRooms(rooms,five,0).rooms[0].style,'sunlit');
 const legacy=emptyPersonalRooms();assert.deepEqual(sanitizePersonalRooms(legacy,STARTER_ELEMENTS,0),legacy);
 const bad=structuredClone(rooms) as any;bad.rooms[0].style='unowned-style';assert.equal(validPersonalRooms(bad),false);
});
test('room recipe suggestions always use owned inputs, verified results and new concepts',()=>{
 let owned=[...STARTER_ELEMENTS];for(let i=0;i<20;i++){
  const recipe=nextRoomDiscovery(owned);if(!recipe)break;assert.ok(owned.some(e=>e.name===recipe.first));assert.ok(owned.some(e=>e.name===recipe.second));assert.equal(owned.some(e=>e.name===recipe.result),false);assert.equal(BUILT_IN_PAIR_RECIPES[makePairKey(recipe.first,recipe.second)]?.result,recipe.result);owned.push(discovery(recipe.result));
 }
 assert.ok(owned.length>10);
});

test('Tidy keeps every legacy piece and resolves duplicate shelf assignments without mutating the saved layout',()=>{
 const input=[{...sprite('one'),surface:'left-shelf' as const},{...sprite('two'),surface:'left-shelf' as const},sprite('three',0,0)];const before=JSON.stringify(input);
 const result=tidyRoomPieces(input);assert.equal(JSON.stringify(input),before);assert.equal(result.pieces.length,input.length);assert.deepEqual(result.pieces.map(p=>p.id),input.map(p=>p.id));assert.equal(result.unplaced.length,0);
 for(const p of result.pieces)assert.equal(placementOpen(p,p,result.pieces),true);
});
