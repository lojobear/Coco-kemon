import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyPersonalRooms,validPersonalRooms,piecePoint,pieceDepth,pieceWidth,sanitizePersonalRooms,type RoomPiece} from '../src/lib/personalRoom';
import {freeRoomPlacement,placementOpen,snapRoomPlacement} from '../src/lib/roomPlacement';
import {roomBackdrop,roomAppearance,roomLightFilter,DEFAULT_ROOM_APPEARANCE} from '../src/lib/roomDesign';
import {STARTER_ELEMENTS} from '../src/lib/infiniteCraftData';
const piece:RoomPiece={id:'a',kind:'sprite',name:'Water',nickname:'',variant:'normal',x:4,y:4,size:1,flipped:false};
test('precision placement, intentional overlap, rotation, layering and size survive room validation and restore',()=>{
 const rooms=emptyPersonalRooms();
 const at=freeRoomPlacement(44.123,66.456)!;
 assert.deepEqual(at.free,{left:44.12,top:66.46});
 const p={...piece,...at,rotation:35,layer:2,size:2.2,rendering:'pixel' as const};
 rooms.rooms[0].pieces=[p];
 assert.ok(validPersonalRooms(rooms));
 assert.deepEqual(sanitizePersonalRooms(rooms,STARTER_ELEMENTS,0),rooms);
 assert.deepEqual(piecePoint(p),at.free);
 assert.ok(pieceWidth(p)>pieceWidth(piece));
 assert.ok(pieceDepth(p)>pieceDepth({...piece,x:8,y:8}));
 assert.equal(placementOpen({...piece,id:'b'},at,[p]),true);
 assert.equal(freeRoomPlacement(0,0),null);
 assert.equal(freeRoomPlacement(NaN,70),null);
 assert.ok(snapRoomPlacement(p,50,71.6,[])?.surface==='floor');
 for(const patch of [{free:{left:100,top:60}},{rotation:181},{layer:4},{rendering:'bad'},{size:3}]){const bad=structuredClone(rooms);Object.assign(bad.rooms[0].pieces[0],patch);assert.equal(validPersonalRooms(bad),false);}
});
test('custom studio design is deterministic, editable and backward compatible',()=>{
 const rooms=emptyPersonalRooms();const r=rooms.rooms[0];
 assert.equal(roomBackdrop(r,'/classic.png'),'/classic.png');
 r.appearance={...DEFAULT_ROOM_APPEARANCE,shell:'studio',wall:'#ff0000',floor:'#00ff00',pattern:'tiles',lighting:'warm',fixtures:false};
 assert.ok(validPersonalRooms(rooms));
 const svg=decodeURIComponent(roomBackdrop(r,'/classic.png').split(',')[1]);
 assert.match(svg,/#ff0000/);assert.match(svg,/#00ff00/);assert.doesNotMatch(svg,/#ede6d6/);
 assert.notEqual(roomBackdrop({...r,appearance:{...r.appearance,fixtures:true}},''),roomBackdrop(r,''));
 assert.notEqual(roomLightFilter(roomAppearance(r).lighting),'none');
 assert.deepEqual(sanitizePersonalRooms(rooms,STARTER_ELEMENTS,0),rooms);
 const bad=structuredClone(rooms);bad.rooms[0].appearance!.wall='url(https://example.com)';assert.equal(validPersonalRooms(bad),false);
});
