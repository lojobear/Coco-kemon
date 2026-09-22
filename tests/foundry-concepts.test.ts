import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { conceptMaterial } from '../src/lib/conceptMaterial';
import { validMaterial } from '../src/lib/validation';
import { ALL_PROCESSES } from '../src/lib/starterData';

test('Foundry Mix shares animal, food, brand and character results with Craft', async () => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = '';
  const { app } = await import('../server');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    for (const [a,b,expected] of [['Animal','Water','Fish'], ['Mouse','Spark','Pikachu'], ['Coffee','Canada','Tim Hortons'], ['Plumber','Mushroom','Mario'], ['Fish','Fire','Grilled Fish']]) {
      const inputMaterialA = conceptMaterial({ result:a, emoji:'✨' });
      const inputMaterialB = conceptMaterial({ result:b, emoji:'✨' });
      assert.ok(validMaterial(inputMaterialA));
      const foundry = await fetch(base + '/api/synthesize', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({inputMaterialA,inputMaterialB,process:ALL_PROCESSES.find(p=>p.id==='MIX')}) });
      assert.equal(foundry.status, 200);
      const data = await foundry.json();
      assert.ok(validMaterial(data.material));
      assert.equal(data.material.displayName, expected);
      assert.deepEqual(data.material.lineage.parentIds, [inputMaterialA.id,inputMaterialB.id]);
      const craft = await fetch(base + '/api/pair', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({first:a,second:b})});
      assert.equal((await craft.json()).result, expected);
    }
  } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
