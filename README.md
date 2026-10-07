# Coco-kemon / QuarkPop

Concept crafting, material synthesis, and a collectible creature foundry built with React, Vite, Express, and Gemini.

## Run

Use Node 22 or newer. Install dependencies with `npm ci`, copy `.env.example` to `.env`, and set `GEMINI_API_KEY` on the server. Never expose the key in a Vite/client environment variable.

```sh
npm run dev
# If the environment does not support the tsx CLI's IPC socket:
node --import tsx server.ts
```

`GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` select the model order. If not configured, the existing defaults are `gemini-3.1-flash-lite` followed by `gemini-3.8-flash`. Model access and quota depend on your key; neither availability nor free-tier access is assumed. `/api/health` reports the same sanitized model order used by generation. General requests use up to two model attempts (12 seconds each). Foundry transformations may also use a five-second concept-planning call; all stages share a 28-second budget, below the browser's 30-second timeout. Quota and authentication failures stop immediately, including during planning.

```sh
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

Production needs a persistent Node service for the Express API, not static file hosting alone. `PORT` defaults to 3000.

## Discovery behaviour

Built-in recipes work without an API key. Unknown combinations, failed photo/sketch analysis, and incomplete AI results display an error instead of adding invented fallback discoveries. Retry keeps the original crafting ingredients available. Skipping an animation never skips the network result.

New element/discovery sprites use Gemini native image generation, then are normalized to cached 512×512 PNGs in the browser for substantially richer pixel-art detail. The art direction targets polished RPG/crafting inventory icons with dark outlines, controlled color ramps, crisp highlights, and transparent backgrounds. Existing cached sprites are preserved until explicitly upgraded or rerolled. Procedural material/Oddkin renderers remain available as fallbacks/default restoration.

## Backups

Save Management exports a version 2 JSON backup containing **both** the crafting collection (including element recipes) and the Foundry materials, Oddkin, processes, habitats, and experiment history. Imports validate nested data before writing. Version 1 Foundry backups remain supported and preserve the current crafting collection.

Both collections are committed in one browser-storage write. If storage is full, the previous committed save is preserved and a visible warning asks you to export your in-memory progress. Progress remains specific to this browser/device; export regularly before clearing browser data. Invalid saved data is preserved for recovery instead of overwritten with starters.

## Verification

`npm test` checks complete/legacy backup round trips, malformed imports, storage quota errors, HTTP/JSON/timeout failures, Gemini retry behaviour, and canonical API recipes without a key. AI calls are mocked in tests; verifying live model access requires a configured key.

## Google login and cloud saves

The Cloud save button connects Google accounts to private Supabase backups covering both collections, including shiny unlocks. Device saving stays automatic; cloud Save and Load are manual and confirm replacements. See [setup instructions](docs/google-cloud-saves.md) for the database migration, Google OAuth configuration, Vercel variables, and verification steps. Until configured, the app supports local play and JSON backups.


## Foundry usability and reliability

Foundry discoveries can be filtered by category or name/tags and sorted by collection order, newest, or name. Selected tiles show ingredient A/B badges, including A + B for repeated inputs. The dock supports swapping and clearing ingredients; artwork outside the viewport loads lazily.

Recipe memory compares exact ingredient counts: A+A never reuses A+B or unary A. Repeated taps share one in-flight synthesis. Rediscovering a canonical material keeps its original artwork and lineage and is labelled as a rediscovery. No-reaction results show an explicit experiment outcome with a next action, rather than an empty discovery card.


## Android / Google Play

The repository now includes a Capacitor 8 Android packaging layer in `mobile/` and a manual GitHub Actions workflow named **Android Play Bundle**. It generates an Android App Bundle (`.aab`) for Google Play plus a debug APK for device testing while loading the production Cloudflare Workers deployment.

The default Android package ID is `com.logaandavid.quarkpop`; choose the final package ID before the first Play Console upload because it should not change afterward. Release signing is supported through GitHub Actions secrets so the upload keystore never needs to be committed.

See [mobile/README.md](mobile/README.md) for build commands and [docs/google-play-release.md](docs/google-play-release.md) for the Play Console checklist.
