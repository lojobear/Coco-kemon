import type { Express } from 'express';
/** Arena is paused across all clients, including older installed previews. */
export function registerArenaProxy(app: Express) {
 app.all('/api/arena/:action',(_req,res)=>res.status(503).set('Cache-Control','no-store').json({error:'Arena is paused for now.'}));
}
