# Coco-kemon / Oddkin Foundry

Concept crafting, material synthesis, and a collectible creature foundry built with React, Vite, Express, and Gemini.

## Run

Use Node 22 or newer. Install dependencies with `npm ci`, copy `.env.example` to `.env`, and set `GEMINI_API_KEY` on the server. Never expose the key in a Vite/client environment variable.

```sh
npm run dev
# If the environment does not support the tsx CLI's IPC socket:
node --import tsx server.ts
```

`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`. `GEMINI_FALLBACK_MODEL` is optional and disabled by default. Configure only a model your key can access. No free-tier availability is assumed. A request makes at most two model calls; quota/auth failures are not retried. Each model call has a 12-second timeout; browser requests stop after 30 seconds.

```sh
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

Production needs a persistent Node service for the Express API, not static file hosting alone. `PORT` defaults to 3000.

## Discovery behaviour

Built-in recipes work without an API key. Unknown combinations, failed photo/sketch analysis, and incomplete AI results display an error instead of adding invented fallback discoveries. Retry keeps the original crafting ingredients available. Skipping an animation never skips the network result.

Material sprites are procedural PNGs drawn directly on a transparent 64×64 pixel grid. Object names select recognizable forms; semantic tags and inherited colours influence details. This is a local renderer, not a separate image-generation service. Existing material sprite caches refresh on load; creature art retains its existing renderer.

## Backups

Save Management exports a version 2 JSON backup containing **both** the crafting collection (including element recipes) and the Foundry materials, Oddkin, processes, habitats, and experiment history. Imports validate nested data before writing. Version 1 Foundry backups remain supported and preserve the current crafting collection.

Both collections are committed in one browser-storage write. If storage is full, the previous committed save is preserved and a visible warning asks you to export your in-memory progress. Progress remains specific to this browser/device; export regularly before clearing browser data. Invalid saved data is preserved for recovery instead of overwritten with starters.

## Verification

`npm test` checks complete/legacy backup round trips, malformed imports, storage quota errors, HTTP/JSON/timeout failures, Gemini retry behaviour, and canonical API recipes without a key. AI calls are mocked in tests; verifying live model access requires a configured key.
