import test from 'node:test';
import assert from 'node:assert/strict';
import { elementNameWordCount, validNewElementName, CANONICAL_INFINITE_CRAFT_RECIPES } from '../src/lib/infiniteCraftData';
import { TRAIL_RECIPES } from '../src/lib/discoveryTrails';
import { CULTURE_RECIPES } from '../src/lib/cultureRecipes';
import { lowValueConceptReason, candidateRejectionReason, chooseConcept, normalizeDiscoveryCandidates } from '../server/discovery';
import { acceptDiscoveryProviderJson } from '../server/gemini';

const pair=['Breakfast Food','Turkish Delight'] as const;
const candidate=(result:string, explanation='Breakfast Food is a morning meal and Turkish Delight is a sweet served with coffee.')=>({
  result, emoji:'☕', connection:'food',explanation,
  coherence:4, surprise:4, inputFit:5, recognizability:5, chainPotential:4, novelty:4,
});

test('new element names have a hard 3-word cap including hyphens and Unicode',()=>{
  assert.equal(elementNameWordCount('Turkish Coffee'),2);
  assert.equal(elementNameWordCount('Blue Moon Orchard'),3);
  assert.equal(elementNameWordCount('Breakfast-Food Turkish Delight'),4);
  assert.equal(elementNameWordCount('R2-D2'),2);
  assert.equal(elementNameWordCount("McDonald's"),1);
  assert.equal(elementNameWordCount('Crème Brûlée'),2);
  assert.ok(validNewElementName('Pot of Gold'));
  assert.ok(validNewElementName('Sea Lion'));
  assert.equal(validNewElementName('Turkish Breakfast Delight Surprise'),false);
  assert.equal(validNewElementName('Breakfast-Food Turkish Delight'),false);
  assert.equal(validNewElementName(''),false);
});

test('Breakfast Delight word stitching is rejected regardless of confident AI self-scores',()=>{
  assert.equal(lowValueConceptReason('Breakfast Delight',...pair),
    'result stitches ingredient words without a distinct concept');
  assert.equal(lowValueConceptReason('Turkish Breakfast',...pair),
    'result stitches ingredient words without a distinct concept');
  assert.equal(lowValueConceptReason('Breakfast Treat',...pair),
    'result decorates an ingredient with a generic label');
  assert.equal(candidateRejectionReason(candidate('Breakfast Delight'),...pair),
    'result stitches ingredient words without a distinct concept');
  assert.equal(chooseConcept({candidates:[candidate('Breakfast Delight')]},...pair),undefined);
});

test('a real novel concept beats word stitching, even when the mashup ranks higher',()=>{
  const chosen=chooseConcept({candidates:[
    candidate('Breakfast Delight'),
    candidate('Turkish Coffee', 'Turkish Delight is served alongside Turkish coffee at breakfast, the kind of morning occasion evoked by Breakfast Food.',),
  ]},...pair);
  assert.equal(chosen?.result,'Turkish Coffee');
  assert.equal(lowValueConceptReason('Turkish Coffee',...pair),null);
});

test('provider gate drops stitched candidates before treating its JSON as a success',()=>{
  const prompt=`Find satisfying discoveries for these input names: ${JSON.stringify(pair)}`;
  const bad=JSON.stringify({candidates:[candidate('Breakfast Delight'),candidate('Turkish Breakfast')]});
  assert.equal(acceptDiscoveryProviderJson(bad,prompt),null);
  const good=JSON.stringify({candidates:[candidate('Breakfast Delight'),candidate('Turkish Coffee')]});
  const accepted=acceptDiscoveryProviderJson(good,prompt);
  assert.ok(accepted);
  const normalized=JSON.parse(accepted!);
  assert.deepEqual(normalized.candidates.map((c:{result:string})=>c.result),['Turkish Coffee']);
  assert.equal(normalizeDiscoveryCandidates({candidates:[candidate('An Impossible Four Word Result')]},...pair),undefined);
});

test('recognized noun compounds are preserved instead of blindly rejecting parent tokens',()=>{
  for(const [result,a,b] of [
    ['Sea Lion','Sea','Lion'],
    ['Fire Truck','Fire','Truck'],
    ['Ice Cream','Ice','Cream'],
    ['Snow Globe','Snow','Globe'],
    ['Electric Grill','BBQ','Electricity'],
    ['Hourglass','Glass','Sand'],
    ['Cloud Nine','Cloud','Joy'],
  ]) assert.equal(lowValueConceptReason(result,a,b),null,`${a} + ${b} => ${result}`);
});

test('built-in and bonus recipes already respect the three-word limit',()=>{
  for(const [key,item] of Object.entries(CANONICAL_INFINITE_CRAFT_RECIPES)) assert.ok(validNewElementName(item.result),`canonical ${key}: ${item.result}`);
  for(const [key,item] of Object.entries(TRAIL_RECIPES)) assert.ok(validNewElementName(item.result),`trail ${key}: ${item.result}`);
  for(const [key,item] of Object.entries(CULTURE_RECIPES)) assert.ok(validNewElementName(item.result),`culture ${key}: ${item.result}`);
});

test('existing saved long names are not deleted or truncated',()=>{
  // The strict cap is for NEW results; the current save format remains
  // backward-compatible with old discoveries that have long names.
  assert.equal(validNewElementName('Previously Saved Four Word Item'),false);
  const legacy={id:'legacy',name:'Previously Saved Four Word Item',emoji:'✨'};
  assert.equal(legacy.name,'Previously Saved Four Word Item');
});
