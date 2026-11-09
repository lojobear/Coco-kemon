# Element values and selling

Element values are denominated in in-game Boop Coins. The price is derived from the normalized concept name, retained rarity tier, and selected owned form. It is independent of artwork, account identifiers, device time, and craft repetition. Cards show the highest-valued owned form; details show the selected form. Rarity and form multipliers are documented in README.md and exported from `src/lib/elementValue.ts`.

Each completed craft earns one sellable copy, assigned to the highest-valued form rolled on that craft. Known historical finishes are conservatively allocated from legacy craft counts without creating more copies than recorded crafts. Supplied starter inventory grants no stock. Selling a copy keeps the discovery, recipes, artwork, badges, and unlocked forms in the collection.

The wallet and sold-copy receipts share a single durable storage commit. Sales recheck stock and the displayed price; exhausted inventory, stale saves, changed prices, and failed writes do not award coins. Existing delayed craft writes are flushed before selling.

## Deployment

Apply `supabase/migrations/20261109181249_boop_economy_save_format.sql` before deploying wallet-aware cloud backups. It permits version 3 snapshots alongside version 2 without changing ownership policies, grants, or the existing compare-and-swap write RPC. Until applied, local play and JSON exports work, but the database rejects version 3 cloud saves.

The migration is tested using a local Postgres engine. It is not automatically applied to production.

Version 3 local and JSON/cloud saves include the wallet and receipts. The existing storage key is retained so older builds' version guards protect the new data. Version 2 snapshots restore the older complete game state with an empty wallet; version 1 Foundry-only imports preserve current Craft and wallet progress.

## Verification and scope

Run `npm test`, `npm run lint`, and `npm run build`. With the local server and Playwright available, run `node tests/economy-smoke.mjs` for the craft/value/sort/sell/reload flow. The browser script supports `BOOP_BASE_URL`, `CHROMIUM_PATH`, and `BOOP_AUDIT_OUTPUT`.

This feature implements a private game wallet and selling. Cross-player trading requires a separate authoritative inventory and transaction service. Future online transactions must revalidate inventory and prices on the server.
