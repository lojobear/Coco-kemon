import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDiscoveryCandidates, chooseConcept } from '../server/discovery';
import { acceptDiscoveryProviderJson } from '../server/gemini';

const prompt = (first:string, second:string) =>
  `Find satisfying discoveries for these input names: ${JSON.stringify([first,second])}`;

test('compact AI JSON without numerical ranking fields is playable and keeps both-parent meaning', () => {
  const response = { candidates: [
    { result:'Hourglass', emoji:'⌛', connection:'technology',
      explanation:'Glass forms the sealed chambers where Sand flows to measure time.' }
  ] };
  const valid = normalizeDiscoveryCandidates(response, 'Glass', 'Sand');
  assert.ok(valid);
  assert.equal(valid?.candidates.length,1);
  assert.equal(chooseConcept(valid,'Glass','Sand')?.result,'Hourglass');
});

test('provider payloads with aliases and optional string scores are repaired', () => {
  const payload = { results: [
    { name:'Skywriting', reason:'Worm-like trails curve across a Cloud as skywriting.', category:'art', coherence:'4' },
    { name:'Worm-Shaped Cloud', reason:'Worm makes a Cloud worm-shaped.', category:'appearance' },
  ]};
  const normalized = normalizeDiscoveryCandidates(payload, 'Worm','Cloud');
  assert.equal(normalized?.candidates.length,1);
  assert.equal(normalized?.candidates[0].result,'Skywriting');
  assert.equal(normalized?.candidates[0].emoji,'✨');
  assert.equal(normalized?.candidates[0].coherence,4);
  assert.equal(chooseConcept(normalized,'Worm','Cloud')?.result,'Skywriting');
});

test('invalid cosmetic and synonym results never masquerade as a successful provider answer', () => {
  const raw=JSON.stringify({candidates:[
    {result:'Worm-Shaped Cloud',emoji:'☁️',connection:'appearance',explanation:'Worm gives Cloud a worm shape.'},
    {result:'Cloud Worm',emoji:'🐛',connection:'appearance',explanation:'Worm and Cloud combine into Cloud Worm.'},
  ]});
  const parsed=acceptDiscoveryProviderJson(raw,prompt('Worm','Cloud'));
  // Literal concatenation and cosmetic descriptions both rejected.
  assert.equal(parsed,null);
  const synonym=acceptDiscoveryProviderJson(JSON.stringify({result:'Grill',emoji:'🔥',explanation:'BBQ changes Rain into Grill.'}),prompt('BBQ','Rain'));
  assert.equal(synonym,null);
});

test('valid provider discovery can be accepted even without four candidates or numerical self-ratings',()=>{
  const raw=JSON.stringify({result:'Geyser',explanation:'Fire heats Water below ground until a Geyser erupts.'});
  const accepted=acceptDiscoveryProviderJson(raw,prompt('Fire','Water'));
  assert.ok(accepted);
  const normalized=JSON.parse(accepted!);
  assert.equal(normalized.candidates[0].result,'Geyser');
  assert.equal(normalized.candidates[0].emoji,'✨');
  assert.equal(normalized.candidates[0].connection,'function');
  assert.equal(acceptDiscoveryProviderJson('{"candidates":[]}',prompt('Fire','Water')),null);
});
