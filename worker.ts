import type { ArenaEnv } from './server/arenaApi.js';
export { BoopArena } from './server/arenaObjects.js';
import { BOT_REGISTRY } from './src/lib/botCollectors.js';
import { handleAsNodeRequest } from 'cloudflare:node';
import { app } from './server.js';
import { setWorkersAiBinding } from './server/workersAi.js';
import { setPersistentCacheBinding } from './server/cacheBinding.js';
import { registerBloopRoutes, runBloopTick } from './server/bloop.js';
import { runRecoveryPass } from './server/spriteRecovery.js';
import { setImageBudgetBinding } from './server/imageBudgetBinding.js';
export { BoopImageBudgetLedger } from './server/imageBudgetLedger.js';

// nodejs_compat populates process.env from text/secret bindings at this compatibility date.
// Workers AI is an object binding, so expose it to the shared Express server explicitly.
registerBloopRoutes(app);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error: any, _req: any, res: any, _next: any) => {
  const status = error?.status === 413 ? 413 : error?.status === 400 ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid request body.' : 'Server error. Please retry.' });
});
app.listen(3000);

export default {
  fetch(request: Request, env: { AI?: any; QUARKPOP_CACHE?: any; BOOP_IMAGE_BUDGET?: any } & ArenaEnv) {
    if (new URL(request.url).pathname.startsWith('/api/arena/')) return Response.json({error:'Arena is paused for now.'},{status:503,headers:{'Cache-Control':'no-store'}});
    setWorkersAiBinding(env.AI);
    setPersistentCacheBinding(env.QUARKPOP_CACHE);
    setImageBudgetBinding(env.BOOP_IMAGE_BUDGET);
    return handleAsNodeRequest(3000, request);
  },
  scheduled(event: {scheduledTime?:number; cron?:string}, env: { AI?: any; QUARKPOP_CACHE?: any; BOOP_IMAGE_BUDGET?: any } & ArenaEnv, ctx: { waitUntil(p: Promise<unknown>):void }) {
    setWorkersAiBinding(env.AI);
    setPersistentCacheBinding(env.QUARKPOP_CACHE);
    setImageBudgetBinding(env.BOOP_IMAGE_BUDGET);
    if (event.cron === '*/15 * * * *') {
      ctx.waitUntil(runBloopTick(event.scheduledTime || Date.now()).then(report => console.info('Bloop tick', report)).catch(error => console.warn('Bloop tick deferred:', String(error).slice(0,160))));
      return;
    }
    ctx.waitUntil(env.BOOP_ARENA.getByName(BOT_REGISTRY).tickBots(event.scheduledTime||Date.now())
      .then(report=>console.info('Boop autonomous collectors',report)).catch(error=>console.warn('Bot collector tick failed:',String(error).slice(0,220))));
    ctx.waitUntil(runRecoveryPass().then(report => console.info('Boop scheduled sprite recovery', report))
      .catch(error => console.warn('Boop scheduled recovery retry pending:', String(error).slice(0,220))));
  },
};
