import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PROCESS_RECIPES, findProcessRecipe } from '../src/lib/processRecipes';
import { processContract, acceptProcessResponse } from '../server/processSemantics';
import { ALL_PROCESSES } from '../src/lib/starterData';
import { conceptMaterial } from '../src/lib/conceptMaterial';
import { validMaterial } from '../src/lib/validation';
import { callGeminiStructured } from '../server/gemini';

const action = ALL_PROCESSES.find(p => p.id === 'FREEZE')!;
const prompt = 'You are the synthesis engine for ODDKIN FOUNDRY\n' + processContract(action, ['Milk', 'Chocolate']);
const response = () => ({status:'new_material', material:{displayName:'Chocolate Ice Cream'}, recipeCheck:{processId:'FREEZE',contributions:[{input:'Milk', contribution:'The creamy base.'},{input:'Chocolate',contribution:'The chocolate flavor.'}],processEffect:'Freezing sets the flavored milk into a frozen dessert.'}});

test('all 500 actions carry their own authoritative meaning and contribution contract', () => {
  for (const action of ALL_PROCESSES) {
    const contract=processContract(action,['First','Second']);
    assert.ok(contract.includes(action.verb));
    assert.ok(contract.includes(action.description));
    assert.ok(contract.includes('Never silently ignore the second ingredient'));
    assert.ok(contract.includes('no_reaction'));
  }
});

test('process acceptance rejects a missing parent, wrong action, unchanged parent and malformed responses', () => {
  assert.ok(acceptProcessResponse(JSON.stringify(response()),prompt));
  for (const mutate of [
    (r:any)=>delete r.recipeCheck,
    (r:any)=>r.recipeCheck.processId='HEAT',
    (r:any)=>r.recipeCheck.contributions.pop(),
    (r:any)=>r.recipeCheck.contributions[1].input='Vanilla',
    (r:any)=>r.recipeCheck.contributions[1].contribution='',
    (r:any)=>r.material.displayName='Milk',
    (r:any)=>r.status='unexpected',
  ]) { const r=response();mutate(r);assert.equal(acceptProcessResponse(JSON.stringify(r),prompt),null); }
  assert.equal(acceptProcessResponse('{',prompt),null);
  assert.ok(acceptProcessResponse(JSON.stringify({status:'no_reaction',explanation:'Cooling does not create a new connection here.'}),prompt));
  assert.equal(acceptProcessResponse(JSON.stringify({status:'no_reaction',explanation:''}),prompt),null);
});

test('recipe matching preserves input multiplicity, exact arity and process identity', () => {
  for (const r of PROCESS_RECIPES) {
    assert.ok(ALL_PROCESSES.some(p=>p.id===r.processId));
    assert.equal(findProcessRecipe(r.processId,[...r.inputs].reverse()),r);
    assert.equal(findProcessRecipe(r.processId,[...r.inputs,'Extra']),undefined);
  }
  assert.equal(findProcessRecipe('HEAT',['Milk','Milk']),undefined);
  assert.equal(findProcessRecipe('FREEZE',['Milk','Chocolate'])?.result,'Chocolate Ice Cream');
  assert.equal(findProcessRecipe('HEAT',['Milk','Chocolate'])?.result,'Hot Chocolate');
});

test('synthesis serves process contrasts offline, with both parents and the selected action in lineage', async () => {
  process.env.NODE_ENV='test';
  const {app}=await import('../server');
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  try {
    for (const recipe of PROCESS_RECIPES) {
      const parents=recipe.inputs.map(result=>conceptMaterial({result,emoji:'✨'}));
      for (const inputs of parents.length===2 ? [parents,[...parents].reverse()] : [parents]) {
        const res=await fetch(base+'/api/synthesize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inputMaterialA:inputs[0],inputMaterialB:inputs[1],process:{id:recipe.processId}})});
        assert.equal(res.status,200,JSON.stringify(recipe));
        const data=await res.json();
        assert.equal(data.material.displayName,recipe.result);
        assert.ok(validMaterial(data.material),recipe.result);
        assert.equal(data.material.lineage.processId,recipe.processId);
        assert.deepEqual(data.material.lineage.parentIds,inputs.map(p=>p.id));
      }
    }
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('Gemini rejects a weak process response and uses the existing fallback within the same request', async () => {
  const previous=process.env.GEMINI_MODEL, fallback=process.env.GEMINI_FALLBACK_MODEL;
  process.env.GEMINI_MODEL='primary';process.env.GEMINI_FALLBACK_MODEL='fallback';
  let finalCalls=0;
  try {
    const raw=await callGeminiStructured(prompt,undefined,.4,{models:{generateContent:async(args:any)=>{
      if(String(args.contents).startsWith('You are the concept-search stage')) return {text:'{}'};
      finalCalls++;
      return {text:JSON.stringify(finalCalls===1?{status:'new_material',material:{displayName:'Hot Chocolate'}}:response())};
    }}} as any);
    assert.equal(finalCalls,2);
    assert.equal(JSON.parse(raw).material.displayName,'Chocolate Ice Cream');
  } finally {
    if(previous===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=previous;
    if(fallback===undefined)delete process.env.GEMINI_FALLBACK_MODEL;else process.env.GEMINI_FALLBACK_MODEL=fallback;
  }
});

test('primary synthesis has room for a complete material and its ingredient check', async () => {
  const previousFetch=globalThis.fetch, previousKey=process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY='test-only';let calls=0;
  globalThis.fetch=async (_url:any,options:any)=>{
    calls++;const body=JSON.parse(options.body);
    assert.equal(body.max_completion_tokens,2200);
    assert.ok(body.messages.some((m:any)=>m.content.includes('PROCESS CONTRACT DATA:')));
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(response())}}]}),{status:200});
  };
  try {
    const raw=await callGeminiStructured(prompt);
    assert.equal(JSON.parse(raw).material.displayName,'Chocolate Ice Cream');
    assert.equal(calls,1);
  } finally {
    globalThis.fetch=previousFetch;
    if(previousKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previousKey;
  }
});
