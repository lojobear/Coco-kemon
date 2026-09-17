import { build } from 'esbuild';
// Use Node package exports, not browser stubs, for the shared Express backend.
await build({
  entryPoints: ['worker.ts'], outfile: '.worker-build/index.js', bundle: true,
  platform: 'node', format: 'esm', target: 'es2022',
  external: ['cloudflare:node'],
  alias: { '@google/genai': '@google/genai/web' },
  define: { 'process.env.CLOUDFLARE': '"1"', 'process.env.NODE_ENV': '"production"' },
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire("file:///worker.js");' },
});
