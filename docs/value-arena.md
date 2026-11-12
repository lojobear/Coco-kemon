# Value Arena

Arena is a casual public 1-vs-1 category match. Sign in, save a collection through Cloud saves, open Arena from Craft, select a category and press Quick match. Players are paired randomly within that category. If no human joins within 12 seconds, a clearly labeled bot joins. Each match allows 45 seconds to lock one discovery. Picks stay hidden until both players submit, time expires, or someone forfeits. Highest snapshotted guide value wins; equal values draw. There is no wager, coin prize, inventory transfer or consumption.

The server verifies the Supabase session and reads only that account's cloud save with the user's bearer token and existing RLS. A match freezes eligible names, available forms and calculated guide prices at entry; the client submits only a selection key. This verifies membership in the submitted cloud collection and prevents arbitrary score submission. Cloud saves remain editable/importable in the existing offline game, so this is not an audited anti-cheat inventory or a ranked economy.

A Cloudflare Durable Object coordinates each category queue, and separate objects store each match. SQL writes before awaited work prevent duplicate assignment. Duplicate queue requests reconnect to the same ticket, submitted picks are immutable, outsiders cannot read matches, and only the opponent's final selection is revealed. Match snapshots expire after inactivity; queues and match data are removed by alarms. No access tokens, email addresses or uploaded artwork are stored in match state. Player labels use a short account identifier; bots use explicit fictional labels. Bots commit a random category pick before the human submits. Where the curated bot pool has no category, it uses a category training pool drawn from the entrant's snapshot.

Worker routes handle `/api/arena/*` directly. The Node/Vercel backend proxies these requests to the same production Worker, so both sites and APK clients share the same lobby. No Supabase schema change or service-role key is required. The existing project's public Supabase URL/key are used; update the frontend and Arena auth configuration together if moving projects.

## Deployment

Wrangler migration `v2-value-arena` creates the SQLite-backed `BoopArena` namespace and `BOOP_ARENA` binding. A new Durable Object class requires an initial full `wrangler deploy`; preview-only `wrangler versions upload` cannot apply that migration. Main's existing Workers Builds deployment runs the required full deploy. Until that first production release, a preview build may report the pending migration. Generate bindings with `wrangler types worker-configuration.d.ts --include-runtime false`; runtime class types are imported from the installed Cloudflare type module to keep browser/Node globals unchanged.

## Meanings

New discoveries can use short parenthetical sense labels, such as `Smoker (barbecue)` and `Smoker (cigarettes)`. These remain separate canonical names, recipe keys, category identities and values. Generation prompts request qualifiers; known ambiguous words are also qualified from clear recipe/explanation context. Contradictory or insufficient context is not assigned a guessed sense; the display uses an unspecified qualifier. Existing ambiguous discoveries can show an inferred label without renaming the saved identity or creating extra copies. Existing wallets, receipts, art and save versions are unchanged.

## Verification

- `npm run lint`, `npm test`, `npm run build`.
- `npm run test:cloudflare` checks the actual production Worker config and auth gate.
- `ARENA_RUNTIME=1 node --import tsx --test tests/arena-runtime.test.ts` starts local workerd with a test-only fixture and isolated SQLite storage. It checks two-player pairing, concurrent matching, hidden picks, unauthorized access, unowned picks, immutable submissions, forged score rejection, persistence across restart, bots, forfeits and deadlines. The fixture is not imported by the production entry point.
- `node tests/arena-smoke.mjs` checks guest sign-in, public queue, hidden human picks, results, bots, replay and network errors at phone/desktop sizes. Auth and Arena responses are mocked in this UI test; no real user accounts or AI credits are used.
