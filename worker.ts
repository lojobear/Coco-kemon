import { httpServerHandler } from 'cloudflare:node';
import { app } from './server.js';

// nodejs_compat populates process.env from Worker bindings at this compatibility date.
// Register JSON errors after API routes, then bind the shared Express app to the adapter.
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error: any, _req: any, res: any, _next: any) => {
  const status = error?.status === 413 ? 413 : error?.status === 400 ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid request body.' : 'Server error. Please retry.' });
});
app.listen(3000);
export default httpServerHandler({ port: 3000 });
