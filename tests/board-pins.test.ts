import test from 'node:test';import assert from 'node:assert/strict';
import {withoutUnpinnedInputs,pinnedResultPosition} from '../src/lib/boardPins';
import {parseBoardLayout} from '../src/lib/boardLayout';
import {tidyBoard} from '../src/lib/tidyBoard';
test('pinned ingredients survive repeated crafts and restore through saved layouts',()=>{
 const items=[{instanceId:'anchor',name:'Water',emoji:'💧',x:980,y:700,pinned:true},{instanceId:'other',name:'Fire',emoji:'🔥',x:1140,y:700}];
 assert.deepEqual(withoutUnpinnedInputs(items,['anchor','other']),[items[0]]);
 assert.deepEqual(withoutUnpinnedInputs(items,['anchor']),items);
 const restored=parseBoardLayout(JSON.parse(JSON.stringify(items)),items.map((e,i)=>({...e,id:String(i)})))!;
 assert.equal(restored[0].pinned,true);assert.equal(restored[1].pinned,undefined);
 const pos=pinnedResultPosition(items[0],items);assert.ok(Math.abs(pos.x-items[0].x)>=160||Math.abs(pos.y-items[0].y)>=140);
 const invalid=parseBoardLayout([{...items[0],pinned:'true'}],items.map((e,i)=>({...e,id:String(i)})))!;assert.equal(invalid[0].pinned,undefined);
});
test('Tidy keeps pinned coordinates and routes unpinned pieces around them',()=>{
 const tiles=[{instanceId:'pin',width:136,height:104,pinned:true,x:16,y:16},...Array.from({length:12},(_,i)=>({instanceId:String(i),width:136,height:104}))];
 const result=tidyBoard(tiles,{width:350,height:600,left:0,top:0},1);assert.deepEqual(result.positions[0],{instanceId:'pin',x:16,y:16});
 for(let i=0;i<result.positions.length;i++)for(let j=0;j<i;j++){
  const a=result.positions[i],b=result.positions[j];assert.ok(Math.abs(a.x-b.x)>=136||Math.abs(a.y-b.y)>=104);
 }
});
