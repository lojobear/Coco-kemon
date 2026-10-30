import { handleAsNodeRequest } from 'cloudflare:node';
import { app } from './server.js';
import { setWorkersAiBinding } from './server/workersAi.js';
import { setPersistentCacheBinding } from './server/cacheBinding.js';
import { runRecoveryPass } from './server/spriteRecovery.js';

// nodejs_compat populates process.env from text/secret bindings at this compatibility date.
// Workers AI is an object binding, so expose it to the shared Express server explicitly.
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error: any, _req: any, res: any, _next: any) => {
  const status = error?.status === 413 ? 413 : error?.status === 400 ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid request body.' : 'Server error. Please retry.' });
});
app.listen(3000);

export default {
  fetch(request: Request, env: { AI?: any; QUARKPOP_CACHE?: any }) {
    setWorkersAiBinding(env.AI);
    setPersistentCacheBinding(env.QUARKPOP_CACHE);
    return handleAsNodeRequest(3000, request);
  },
  scheduled(_event: unknown, env: { AI?: any; QUARKPOP_CACHE?: any }, ctx: { waitUntil(p: Promise<unknown>):void }) {
    setWorkersAiBinding(env.AI);
    setPersistentCacheBinding(env.QUARKPOP_CACHE);
    ctx.waitUntil(runRecoveryPass().then(report => console.info('Boop scheduled sprite recovery', report))
      .catch(error => console.warn('Boop scheduled recovery retry pending:', String(error).slice(0,220))));
  },
};
