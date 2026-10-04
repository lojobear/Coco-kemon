import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';

test('compiled Vercel entrypoint serves health and combinations in plain Node ESM', async () => {
  const root = process.cwd();
  const output = await mkdtemp(path.join(tmpdir(), 'coco-vercel-'));
  try {
    await writeFile(path.join(output, 'package.json'), '{"type":"module"}');
    await symlink(path.join(root, 'node_modules'), path.join(output, 'node_modules'), 'dir');
    // Preserve module imports, as the function runtime does; do not bundle or use tsx.
    for (const file of ['api/index.ts', 'server.ts', 'server/gemini.ts', 'server/emoji.ts', 'server/kitchen.ts', 'src/lib/kitchen/engine.ts', 'src/lib/emojiGeometry.ts', 'src/lib/pixelRenderer.ts', 'server/discovery.ts', 'src/lib/discoveryTrails.ts', 'src/lib/starterData.ts', 'src/lib/extraProcesses.ts', 'src/lib/conceptMaterial.ts', 'src/lib/cultureRecipes.ts', 'src/lib/validation.ts', 'src/lib/infiniteCraftData.ts']) {
      const destination = path.join(output, file.replace(/\.ts$/, '.js'));
      await mkdir(path.dirname(destination), { recursive: true });
      const source = await readFile(path.join(root, file), 'utf8');
      await writeFile(destination, ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText);
    }
    const script = `
      import assert from 'node:assert/strict';
      import { createServer } from 'node:http';
      import app from './api/index.js';
      const server = createServer(app);
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      try {
        const health = await fetch(base + '/api/health');
        assert.equal(health.status, 200);
        assert.equal((await health.json()).status, 'ok');
        for (const route of ['/api/pair', '/api/infinite-craft/pair']) {
          const pair = await fetch(base + route, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first: 'Water', second: 'Fire' }),
          });
          assert.equal(pair.status, 200);
          assert.equal((await pair.json()).result, 'Steam');
        }
        console.log('Compiled Node ESM: health and both combine routes passed');
      } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
    `;
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script], {
      cwd: output, timeout: 15000,
      env: { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production', VERCEL: '1', GEMINI_API_KEY: '' },
    });
    assert.match(stdout, /both combine routes passed/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

