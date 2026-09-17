# Cloudflare Workers deployment

This app deploys a static Vite frontend and an Express API together as one Worker.

## Workers Builds settings

- Root directory: `/`
- Build command: `bun run build`
- Deploy command: `npx wrangler deploy`
- Version command (preview branches): `npx wrangler versions upload`
- Build variable: `BUN_VERSION=1.4.2`

The committed Bun lockfile must be generated with a compatible Bun version. Do not
manually change `lockfileVersion`. After changing dependencies, run
`bun install` with Bun 1.4.2 and commit both `package.json` and `bun.lock`.
Wrangler is pinned in development dependencies for reproducible deployments.

Wrangler runs `scripts/build-worker.mjs` before deployment. It bundles Express
using Node exports and Gemini using its fetch-based web SDK. The Worker starts
Express on port 3000, and `/api` routes run before the SPA asset fallback.
The existing Node/Vercel entry points remain available.

## Runtime configuration

In the Worker's **Settings → Variables and Secrets**, set `GEMINI_API_KEY` as a
secret. Optional model overrides are `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL`.
These belong to the running Worker, not just the build environment. With the
committed compatibility date and `nodejs_compat`, bindings populate `process.env`.

Frontend Supabase configuration uses `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` in the build environment; use the project's public
publishable key, never a service-role key. Rebuild after changing frontend values.

For Google login, add `https://coco-kemon.logaandavid.workers.dev/` to Supabase
Authentication → URL Configuration → Redirect URLs. If this is the primary app,
use it as the Site URL too. Start a fresh login from that same address. An old
Cloud Run Site URL can send users back to the previous deployment.

## Verification

Run `npm test`, `npm run lint`, and `npm run test:cloudflare`.
The Cloudflare test builds the frontend, starts the real local Workers runtime,
and verifies frontend HTML, runtime environment variables, GET/POST combinations,
unknown API routes, and malformed JSON. It does not call Gemini or require a key.

After deployment, check `/api/health`: it should return JSON with `status: "ok"`
and `hasGeminiKey: true`. Water + Fire should produce Steam. Also try a new
AI-generated combination; local deterministic tests do not verify your production
Gemini credentials, model availability, or quota.
