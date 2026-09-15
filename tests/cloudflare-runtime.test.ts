import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

test('wrangler configuration has nodejs_compat, SPA fallback, and worker entrypoint', async () => {
  const root = process.cwd();
  const rawConfig = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
  // Strip jsonc comments for parsing
  const cleanJson = rawConfig.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const config = JSON.parse(cleanJson);

  assert.equal(config.name, 'coco-kemon');
  assert.equal(config.main, 'worker.ts');
  assert.ok(Array.isArray(config.compatibility_flags) && config.compatibility_flags.includes('nodejs_compat'));
  assert.equal(config.assets?.not_found_handling, 'single-page-application');
});

test('worker.ts compiles and bridges Worker secrets to process.env', async () => {
  const root = process.cwd();
  const workerSrc = await readFile(path.join(root, 'worker.ts'), 'utf8');
  const compiled = ts.transpileModule(workerSrc, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });

  assert.ok(compiled.outputText.includes('httpServerHandler'));
  assert.ok(workerSrc.includes('GEMINI_API_KEY'));
  assert.ok(workerSrc.includes('GEMINI_MODEL'));
  assert.ok(workerSrc.includes('GEMINI_FALLBACK_MODEL'));
});
