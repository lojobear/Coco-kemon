import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYFUL_RECIPE_ENTRIES, PLAYFUL_RECIPES } from '../src/lib/playfulRecipes';
import { BUILT_IN_PAIR_RECIPES } from '../src/lib/builtInPairs';
import { CULTURE_RECIPES } from '../src/lib/cultureRecipes';
import { TRAIL_RECIPES } from '../src/lib/discoveryTrails';
import { CANONICAL_INFINITE_CRAFT_RECIPES, STARTER_ELEMENTS, makePairKey, validNewElementName } from '../src/lib/infiniteCraftData';
import { qualifiedConceptName } from '../src/lib/conceptMeaning';
import { knownBotRecipe } from '../src/lib/botCollectors';
import { resolveSharedPair } from '../src/lib/sharedCraftingEngine';
import { groundedPlayfulnessBonus, lowValueConceptReason } from '../server/discovery';
test('playful recipe pack is additive, unique and fully reachable from four starters',()=>{
  assert.equal(Object.keys(PLAYFUL_RECIPES).length,PLAYFUL_RECIPE_ENTRIES.length);
  for(const [key,recipe] of Object.entries(PLAYFUL_RECIPES)){
    assert.equal(CANONICAL_INFINITE_CRAFT_RECIPES[key],undefined,key);
    assert.equal(TRAIL_RECIPES[key],undefined,key);
    assert.equal(CULTURE_RECIPES[key],undefined,key);
    assert.ok(validNewElementName(recipe.result),recipe.result);
    assert.ok(recipe.explanation.length<201);
  }
  const owned=new Set(STARTER_ELEMENTS.map(x=>x.name.toLowerCase()));
  for(let i=0;i<100;i++){
    let changed=false;
    for(const [key,recipe] of Object.entries(BUILT_IN_PAIR_RECIPES)){
      const [first,second]=key.split(':::');
      if(!owned.has(first)||!owned.has(second))continue;
      const name=qualifiedConceptName(recipe.result,`${'explanation' in recipe?recipe.explanation:''} ${first} ${second}`).toLowerCase();
      if(!owned.has(name)){owned.add(name);changed=true;}
    }
    if(!changed)break;
  }
  for(const [a,b,result] of PLAYFUL_RECIPE_ENTRIES)assert.ok(owned.has(a.toLowerCase())&&owned.has(b.toLowerCase()),a+' + '+b+' -> '+result);
});
test('client, server recipe table and bots agree on curated results without a fetch',async()=>{
  for(const [first,second,result] of PLAYFUL_RECIPE_ENTRIES){
    const key=makePairKey(first,second);
    const a=await resolveSharedPair(first,second);
    const b=await resolveSharedPair(second,first);
    assert.equal(a.result,result);assert.equal(b.result,result);
    assert.equal(BUILT_IN_PAIR_RECIPES[key].result,result);
    assert.equal(knownBotRecipe(first,second)?.outcome.result,result);
    assert.equal(a.isNew,false);
  }
  assert.equal((await resolveSharedPair('Water','Fire')).result,'Steam');
});
test('playfulness bonus requires both parents and never rescues a lazy mashup',()=>{
  assert.ok(groundedPlayfulnessBonus({result:'Hot Dog',connection:'wordplay',explanation:'Bread makes the bun; Dog supplies the pun.'},'Bread','Dog')>0);
  assert.equal(groundedPlayfulnessBonus({result:'Hot Dog',connection:'wordplay',explanation:'Bread becomes a sandwich.'},'Bread','Dog'),0);
  assert.equal(groundedPlayfulnessBonus({result:'Worm-Shaped Cloud',connection:'comedy',explanation:'Worm gives Cloud its shape.'},'Worm','Cloud'),0);
  assert.equal(lowValueConceptReason('Breakfast Delight','Breakfast Food','Turkish Delight'),'result stitches ingredient words without a distinct concept');
});
