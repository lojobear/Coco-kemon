import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

test('Workers serves the frontend and JSON APIs using the deployment configuration', {
  skip: process.env.CLOUDFLARE_SMOKE !== '1', timeout: 90_000,
}, async () => {
  const port = 18797;
  const origin = `http://127.0.0.1:${port}`;
  const worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js',
    'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0',
    '--var', 'GEMINI_MODEL:worker-smoke-model'], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  worker.stdout.on('data', chunk => { logs += chunk; });
  worker.stderr.on('data', chunk => { logs += chunk; });
  const closed = new Promise<void>(resolve => worker.once('close', () => resolve()));
  async function request(path: string, init?: RequestInit) {
    return fetch(origin + path, { ...init, signal: AbortSignal.timeout(5000) });
  }
  async function json(path: string, status: number, init?: RequestInit) {
    const response = await request(path, init);
    assert.equal(response.status, status, await response.clone().text());
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    return response.json();
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (worker.exitCode !== null) throw new Error(logs);
      try {
        if ((await request('/api/health')).ok) { ready = true; break; }
      } catch { /* Wait for workerd to start listening. */ }
      await delay(400);
    }
    assert.ok(ready, logs);
    const health = await json('/api/health', 200);
    assert.equal(health.status, 'ok');
    assert.equal(health.primaryModel, 'worker-smoke-model');
    const pair = await json('/api/infinite-craft/pair?first=Water&second=Fire', 200);
    assert.equal(pair.result, 'Steam');
    const postPair = await json('/api/pair', 200, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first: 'Water', second: 'Fire' }),
    });
    assert.equal(postPair.result, 'Steam');
    assert.ok((await json('/api/not-a-route', 404)).error);
    assert.ok((await json('/api/pair', 400, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken',
    })).error);
    const home = await request('/');
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type') || '', /text\/html/);
  } finally {
    worker.kill('SIGTERM');
    const timer = setTimeout(() => worker.kill('SIGKILL'), 5000);
    await closed;
    clearTimeout(timer);
  }
});
