import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { EXPANSION_PROCESSES, expansionRecipe, findExpansionRecipe } from '../src/lib/processExpansion';
import { ALL_PROCESSES, STARTER_MATERIALS, mergeProcesses } from '../src/lib/starterData';
import { availableProcesses } from '../src/lib/availableProcesses';
import { validNewElementName } from '../src/lib/infiniteCraftData';
import { validMaterial } from '../src/lib/validation';

test('200 new unique actions are merged into the seven categories without changing existing locks',()=>{
 assert.equal(EXPANSION_PROCESSES.length,200);
 assert.equal(new Set(ALL_PROCESSES.map(p=>p.id)).size,ALL_PROCESSES.length);
 assert.equal(new Set(EXPANSION_PROCESSES.map(p=>p.name)).size,200);
 assert.equal(new Set(EXPANSION_PROCESSES.map(p=>p.category)).size,7);
 const old=ALL_PROCESSES.filter(p=>!EXPANSION_PROCESSES.some(x=>x.id===p.id));
 const merged=mergeProcesses(old.map(p=>p.id==='POLISH'?{...p,unlocked:true}:p));
 assert.equal(merged.length,old.length+200);
 assert.equal(merged.find(p=>p.id==='POLISH')?.unlocked,true);
 assert.equal(merged.find(p=>p.id==='MAGNETIZE')?.unlocked,false);
 assert.ok(EXPANSION_PROCESSES.every(p=>availableProcesses(old).some(x=>x.id===p.id)));
});
test('every new action has a meaningful exact-input curated recipe, preserving arity and order independence',()=>{
 for(const process of EXPANSION_PROCESSES){
  const recipe=expansionRecipe(process.id)!;
  assert.ok(recipe,process.id);
  assert.ok(validNewElementName(recipe.result),recipe.result);
  assert.ok(recipe.explanation.length<=280,process.id);
  assert.ok(process.verb.length>18);
  assert.deepEqual(findExpansionRecipe(process.id,[...recipe.inputs].reverse()),recipe);
  assert.equal(findExpansionRecipe(process.id,[...recipe.inputs,'Extra']),undefined);
  assert.equal(findExpansionRecipe(process.id,['Unknown Ingredient']),undefined);
  assert.equal(findExpansionRecipe(process.id,[]),undefined);
 }
});
test('new processes return valid lineage through synthesis without an AI key',async()=>{
 process.env.NODE_ENV='test';delete process.env.GEMINI_API_KEY;
 const {app}=await import('../server');
 const server=app.listen(0);await once(server,'listening');
 const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/synthesize';
 try{
  for(const [id,input,result] of [['LATHE_TURN','Wood','Spindle'],['LIGHT_REFRACT','Glass','Prism'],['CHRONICLE','Paper','History Book'],['VACUUM_DEGAS','Water','Degassed Water']]){
   const process=ALL_PROCESSES.find(p=>p.id===id)!;
   const material={...STARTER_MATERIALS[0],id:'test_'+input.toLowerCase(),displayName:input,canonicalName:input.toUpperCase()};
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inputMaterialA:material,process:{id}})});
   assert.equal(response.status,200,id);
   const data=await response.json();
   assert.equal(data.material.displayName,result);
   assert.equal(data.material.lineage.processId,process.id);
   assert.deepEqual(data.material.lineage.parentIds,[material.id]);
   assert.ok(validMaterial(data.material));
  }
 }finally{server.closeAllConnections();server.close();await once(server,'close');}
});
