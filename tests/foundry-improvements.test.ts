import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_MATERIALS } from '../src/lib/starterData';
import { matchesFoundryRecipe, validSynthesisResult, resolveMaterialDiscovery } from '../src/lib/foundryRecipes';
import { ApiFailure, callGeminiStructured, getGeminiModels } from '../server/gemini';
import type { SynthesisResult } from '../src/types';

const [a,b] = STARTER_MATERIALS;
const recipe = (ids: string[]) => ({ ...a, id:'result', lineage:{...a.lineage,parentIds:ids,processId:'MIX'} });

test('recipe lookup preserves multiplicity, arity, and process while ignoring ingredient order', () => {
  assert.equal(matchesFoundryRecipe(recipe([a.id,b.id]),a,b,'MIX'),true);
  assert.equal(matchesFoundryRecipe(recipe([b.id,a.id]),a,b,'MIX'),true);
  assert.equal(matchesFoundryRecipe(recipe([a.id,b.id]),a,a,'MIX'),false);
  assert.equal(matchesFoundryRecipe(recipe([a.id]),a,a,'MIX'),false);
  assert.equal(matchesFoundryRecipe(recipe([a.id,a.id]),a,a,'MIX'),true);
  assert.equal(matchesFoundryRecipe(recipe([a.id,a.id]),a,null,'MIX'),false);
  assert.equal(matchesFoundryRecipe(recipe([a.id,b.id]),a,b,'HEAT'),false);
});

test('existing discoveries require valid material and no-reaction results require an explanation', () => {
  assert.equal(validSynthesisResult({status:'existing_material',explanation:'Already known'}),false);
  assert.equal(validSynthesisResult({status:'existing_material',material:a,explanation:'Already known'}),true);
  assert.equal(validSynthesisResult({status:'no_reaction',explanation:''}),false);
  assert.equal(validSynthesisResult({status:'no_reaction',explanation:'These ingredients did not change.'}),true);
  assert.equal(validSynthesisResult({status:'no_reaction',observationIfFailed:'No change.',explanation:''}),true);
  assert.equal(validSynthesisResult({status:'unexpected',explanation:'bad'} as unknown as SynthesisResult),false);
});

test('rediscovering a canonical item retains original art, timestamp and lineage instead of duplicating it', () => {
  const original = {...a,customSpriteUrl:'data:image/png;base64,AAAA'};
  const incoming = {...a,id:'another-id',canonicalName:` ${a.canonicalName.toLowerCase()} `,discoveredAt:Date.now()};
  const result = resolveMaterialDiscovery(incoming,[original],'new_material');
  assert.equal(result.material,original);
  assert.equal(result.isNew,false);
  assert.equal(resolveMaterialDiscovery(b,[original],'new_material').isNew,true);
});

const prompt = 'You are the synthesis engine for ODDKIN FOUNDRY\nINPUT A: Soil\nAPPLIED PROCESS: Grow';
const client = (generateContent: any) => ({models:{generateContent}}) as any;

test('Foundry planning stops immediately on quota or authentication failure', async () => {
  for (const code of [429,401,403]) {
    let calls=0;
    await assert.rejects(callGeminiStructured(prompt,undefined,.4,client(async () => {calls++;throw {status:code};})),
      (error: unknown) => error instanceof ApiFailure && error.status === (code===429?429:503));
    assert.equal(calls,1,'planning errors must not trigger another billed request');
  }
});

test('Foundry planning and failover share the 25-second request budget', async () => {
  const previousNow=Date.now;
  const previousModel=process.env.GEMINI_MODEL,previousFallback=process.env.GEMINI_FALLBACK_MODEL;
  process.env.GEMINI_MODEL='gemini-primary-test';process.env.GEMINI_FALLBACK_MODEL='gemini-fallback-test';
  let now=1000,calls=0;const timeouts:number[]=[];
  Date.now=()=>now;
  try {
    const result=await callGeminiStructured(prompt,undefined,.4,client(async (args:any) => {
      timeouts.push(args.config.httpOptions.timeout);calls++;
      if(calls===1){now=6000;return {text:'{}'};}
      if(calls===2){now=18000;throw {status:503};}
      return {text:'{"status":"no_reaction","explanation":"No change."}'};
    }));
    assert.equal(JSON.parse(result).status,'no_reaction');
    assert.deepEqual(timeouts,[3000,20000,8000]);
  } finally {
    Date.now=previousNow;
    if(previousModel===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=previousModel;
    if(previousFallback===undefined)delete process.env.GEMINI_FALLBACK_MODEL;else process.env.GEMINI_FALLBACK_MODEL=previousFallback;
  }
});

test('health model configuration follows the same actual default order as generation', () => {
  const previousModel=process.env.GEMINI_MODEL,previousFallback=process.env.GEMINI_FALLBACK_MODEL;
  delete process.env.GEMINI_MODEL;delete process.env.GEMINI_FALLBACK_MODEL;
  try { assert.deepEqual(getGeminiModels(),['gemini-3.5-flash','gemini-3.5-flash-lite']); }
  finally { if(previousModel!==undefined)process.env.GEMINI_MODEL=previousModel;if(previousFallback!==undefined)process.env.GEMINI_FALLBACK_MODEL=previousFallback; }
});
