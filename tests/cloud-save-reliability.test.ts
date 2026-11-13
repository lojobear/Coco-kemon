import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {confirmedCloudWrite,sameCloudPayload,CLOUD_SAVE_TIMEOUT_MS} from '../src/lib/cloudSave';
test('cloud write reconciliation recognizes exact JSONB payload after response timeout',()=>{
 const payload={version:3,crafting:[{id:'water',name:'Water'}],foundry:{materials:[]},economy:{coins:1}};
 const reordered={economy:{coins:1},foundry:{materials:[]},crafting:[{name:'Water',id:'water'}],version:3};
 assert.ok(sameCloudPayload(payload,reordered));
 assert.ok(confirmedCloudWrite({payload:reordered,revision:29,updated_at:'now'},payload,28));
 assert.equal(confirmedCloudWrite({payload:reordered,revision:30,updated_at:'now'},payload,28),false);
 assert.equal(confirmedCloudWrite({payload:{...reordered,economy:{coins:2}},revision:29,updated_at:'now'},payload,28),false);
 assert.equal(confirmedCloudWrite(null,payload,28),false);
 assert.equal(CLOUD_SAVE_TIMEOUT_MS,60000);
});
test('normal progress save does not wait for sprite uploads; near-limit saves compact first',()=>{
 const ui=readFileSync(new URL('../src/components/CloudSaves.tsx',import.meta.url),'utf8');
 const action=ui.slice(ui.indexOf('let json = JSON.stringify(JSON.parse(local))'),ui.indexOf('}>Save to cloud'));
 assert.match(action,/if \(cloudPayloadBytes\(JSON.parse\(json\)\) > CLOUD_SAVE_MAX_BYTES - 256 \* 1024\) \{/);
 assert.match(action,/syncProfileSprites/);
 assert.match(action,/writeCloudSave\(json, snapshot\?\.revision \?\? 0, user.id\)/);
});
