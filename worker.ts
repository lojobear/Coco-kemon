import { handleAsNodeRequest } from 'cloudflare:node';
import { app } from './server.js';
import { setWorkersAiBinding } from './server/workersAi.js';

// nodejs_compat populates process.env from text/secret bindings at this compatibility date.
// Workers AI is an object binding, so expose it to the shared Express server explicitly.
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error: any, _req: any, res: any, _next: any) => {
  const status = error?.status === 413 ? 413 : error?.status === 400 ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid request body.' : 'Server error. Please retry.' });
});
app.listen(3000);

export default {
  fetch(request: Request, env: { AI?: any }) {
    setWorkersAiBinding(env.AI);
    return handleAsNodeRequest(3000, request);
  },
};
