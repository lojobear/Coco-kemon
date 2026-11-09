# Boop

Concept crafting, material synthesis, and a collectible discovery encyclopedia built with React, Vite, Express, Groq, Cloudflare Workers AI, and Gemini.

## Run

Use Node 22 or newer. Install dependencies with `npm ci`, copy `.env.example` to `.env`, and set `GROQ_API_KEY` on the server for primary text generation. Keep `GEMINI_API_KEY` configured for fallback and multimodal/image paths. Never expose either key in a Vite/client environment variable.

```sh
npm run dev
# If the environment does not support the tsx CLI's IPC socket:
node --import tsx server.ts
```

Text generation now uses **Groq first**, then Cloudflare Workers AI, then Gemini as the final text fallback. `GROQ_MODEL` defaults to `openai/gpt-oss-120b` and `GROQ_FALLBACK_MODEL` to `openai/gpt-oss-20b`. `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` remain the final fallback order and continue powering multimodal/photo/sketch flows. `/api/health` reports the active primary provider and fallback stack.

```sh
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

Production needs a persistent Node service for the Express API, not static file hosting alone. `PORT` defaults to 3000.

## Discovery behaviour

Built-in recipes work without an API key. Unknown combinations, failed photo/sketch analysis, and incomplete AI results display an error instead of adding invented fallback discoveries. Retry keeps the original crafting ingredients available. Skipping an animation never skips the network result.

New element/discovery sprites use Cloudflare Workers AI in production, preferring FLUX.2 Klein 4B with FLUX.1 Schnell as a fallback. Generated images are normalized to cached 512×512 PNGs in the browser for richer pixel-art detail. This avoids Gemini image-generation quota failures on projects without paid Gemini image access. Existing cached sprites are preserved until explicitly upgraded or rerolled. Local/non-Cloudflare development can still use Gemini image generation as a fallback.

## Backups

Save Management exports a version 3 JSON backup containing **both** the crafting collection (including element recipes) and the Foundry materials, Oddkin, processes, habitats, and experiment history. Imports validate nested data before writing. Version 1 Foundry backups remain supported and preserve the current crafting collection and wallet. Version 2 backups restore both collections with an empty wallet because those backups predate selling.

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

## Craft accessibility and progress

Craft tiles can be selected with Tab and Enter/Space or by tapping. Select two pieces, then activate Combine; dragging one piece onto another still combines immediately. Duplicate and remove controls have 44px targets. The initial starter board fits the viewport; saved layouts retain their positions. Settings uses a native modal dialog with Escape dismissal and background focus protection.

Supplied starter inventory counts toward the collection but does not count as earned discoveries, crafts, or recent activity. Original untouched starter projections are recognized in older backups without removing artwork or actual crafting history. Each completed recorded craft adds 12 XP to the existing Foundry progression; the amount is derived from saved craft counts, so reloads do not award it again.

Collection filters, sorting, statistics, and artwork repair live under **Filters & collection tools**, leaving stickers visible on entry.

For browser regression checks, with the dev server running and Playwright available, run `node tests/audit-usability-smoke.mjs`. Set `CHROMIUM_PATH` to use an installed browser, `BOOP_BASE_URL` to change the local URL, and `BOOP_AUDIT_OUTPUT` to choose the screenshot directory (default `/tmp/boop-audit-fixes`).

## Modern Toybox design

The Craft screen uses a cream surface, cobalt primary actions, a butter-yellow work mat, and large pixel-art pieces. Tap or keyboard-select two pieces, then choose **Combine**; dragging one piece onto another still combines immediately. Board history, saved layouts, custom artwork, collections, advanced tools, and cloud-save behavior are preserved. New starter images are display defaults, not generated discoveries or replacements for saved artwork.

Visual comparison and responsive verification are recorded in [design-qa.md](design-qa.md), with screenshots under `docs/design/toybox-*`.

## Element values and selling

Every collected concept has a deterministic base value of 10–40 Boop Coins. Rarity multiplies that value: Common ×1, Uncommon ×2, Rare ×5, Epic ×12, Legendary ×30, Mythic ×80, Secret ×250. Individual forms multiply by Standard ×1, Shiny ×4, Holo ×6, Celestial ×10, Glitch ×15; unlocked forms never stack multipliers. Cards show the highest-value owned form and collection sorting supports **Highest value**. Details show the selected form’s value and breakdown.

Each craft earns one sellable copy, assigned to the highest-valued form rolled on that craft. Legacy inventory is conservatively allocated from saved craft counts and known finishes without creating extra copies. Supplied starters have zero stock. Sell one copy from its details panel; the element and its unlocked forms remain in the discovery catalog. Wallet credit and sold-copy receipts commit together, and receipts prevent reselling the same earned copy. Repeated normal crafts do not mint additional special-form copies.

Save format 3 includes the wallet and receipts in local storage and JSON/cloud backups. The existing storage key is intentionally retained so older builds’ version guards reject the new save rather than dropping the wallet. Versions 1 and 2 remain importable. Importing an old v2 snapshot resets the wallet with that snapshot; a v1 Foundry-only import preserves current Craft and wallet data.

**Before deploying wallet-aware cloud backups, apply `supabase/migrations/20261109181249_boop_economy_save_format.sql`.** It allows both v2 and v3 backups without changing RLS, ownership, grants, or the existing compare-and-swap RPC. Without it, local play/export still works but the database rejects v3 cloud saves. The migration is tested locally and is not automatically applied to production.

Boop Coins are a local game currency. Cross-player trading and a shared economy are separate future features; future online transactions must revalidate inventory and prices on the server.

Browser selling regression: with the local server running and Playwright available, run `node tests/economy-smoke.mjs` (supports `BOOP_BASE_URL`, `CHROMIUM_PATH`, and `BOOP_AUDIT_OUTPUT`). It crafts Steam, checks values/sorting, sells one earned copy, verifies the discovery remains unlocked, and reloads to verify the wallet and exhausted stock.
