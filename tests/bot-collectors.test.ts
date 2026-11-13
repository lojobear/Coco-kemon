import test from 'node:test';
import assert from 'node:assert/strict';
import { BOT_DEFINITIONS, BOT_MAX_ITEMS, BOT_CACHE_READS, seedBot, botProfile, botOpponent, botDue, selectKnownBotRecipe, eligibleBotRecipes, applyBotRecipe, knownBotRecipe, cachedBotRecipe, botCacheCandidates, chooseBotCard } from '../src/lib/botCollectors';
import { discoveryIdentity } from '../src/lib/unifiedCollection';
import { makePairKey } from '../src/lib/infiniteCraftData';
const normal={shiny:false,celestial:false,holo:false,glitch:false,tier:'common'} as const;
test('all four collectors bootstrap from owned ingredients, with distinct permanent identities and normal rolls',()=>{
  const states=BOT_DEFINITIONS.map(def=>seedBot(def,1000));
  assert.equal(new Set(states.map(s=>s.id)).size,4);
  for(const [i,s] of states.entries()){
    assert.equal(s.crafts,30);assert.equal(s.items.filter(x=>x.isStarter).length,4);
    assert.ok(s.items.length<=BOT_MAX_ITEMS);assert.ok(s.items.every(x=>x.isStarter||x.recipe));
    assert.ok(s.items.every(x=>!x.unlockedShiny));assert.equal(botProfile(BOT_DEFINITIONS[i],s).discoveries,s.items.length-4);
    const owned=new Set(s.items.map(x=>discoveryIdentity(x.name)));
    for(const item of s.items.filter(x=>!x.isStarter)){assert.ok(owned.has(discoveryIdentity(item.recipe!.first)));assert.ok(owned.has(discoveryIdentity(item.recipe!.second)));}
    assert.ok(botOpponent(BOT_DEFINITIONS[i],s,'Animals')?.cards.length);
    assert.equal(botOpponent(BOT_DEFINITIONS[i],s,'Not a real category'),null);
  }
  assert.ok(new Set(states.map(s=>s.items.map(x=>x.name).sort().join('|'))).size>1);
});
test('scheduled recipes obey cadence, owned ingredients, shared results, and caps',()=>{
  for(const def of BOT_DEFINITIONS){
    let state=seedBot(def,1000);
    assert.equal(botDue(def,state,6),true);assert.equal(botDue(def,{...state,lastSlot:6},6),false);
    assert.equal(botDue(def,state,7),def.interval===1);
    for(let i=0;i<100;i++){
      const recipe=selectKnownBotRecipe(def,state,()=>0)!;assert.ok(recipe);
      const owned=new Set(state.items.map(x=>discoveryIdentity(x.name)));
      assert.ok(owned.has(discoveryIdentity(recipe.first))&&owned.has(discoveryIdentity(recipe.second)));
      assert.equal(knownBotRecipe(recipe.first,recipe.second)?.outcome.result,recipe.outcome.result);
      state=applyBotRecipe(state,recipe,2000+i,normal);
    }
    assert.equal(state.crafts,130);assert.ok(state.items.length<=BOT_MAX_ITEMS);
    assert.ok(eligibleBotRecipes(state).length>0);
  }
});
test('cache-only candidates are bounded, invalid results rejected, and difficulty uses owned cards',()=>{
  const state=seedBot(BOT_DEFINITIONS[0],1000);
  let n=0;const pairs=botCacheCandidates(state,max=>n++%max);
  assert.ok(pairs.length<=BOT_CACHE_READS);assert.equal(new Set(pairs.map(p=>p.key)).size,pairs.length);
  for(const pair of pairs)assert.equal(pair.key,makePairKey(pair.first,pair.second));
  assert.equal(cachedBotRecipe('Water','Fire',{result:'too many words in name',emoji:'✨'}),undefined);
  assert.equal(cachedBotRecipe('Water','Fire',{result:'Valid',emoji:'✨'})?.outcome.isNew,false);
  const cards=[1,2,3,4,5,6].map(n=>({key:String(n),name:String(n),emoji:'✨',category:'Animals',coins:n,form:'normal'}));
  assert.equal(chooseBotCard(cards,'Easy',()=>0).coins,1);
  assert.equal(chooseBotCard(cards,'Hard',()=>0).coins,5);
  assert.equal(chooseBotCard(cards,'Expert',max=>max-1).coins,6);
  assert.throws(()=>applyBotRecipe(state,{first:'Unowned',second:'Water',outcome:{result:'New',emoji:'✨',isNew:false}},1000,normal),/own both/);
});
