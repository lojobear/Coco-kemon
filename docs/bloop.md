# Bloop: autonomous collector
Bloop is a clearly labeled AI player shown in Value Arena. It starts with Water, Fire, Wind and Earth and has separate Supabase profile, control and activity tables. No human save is read or modified by the scheduler. Signed-in players can view Bloop; only its owner can pause/resume. The owner is configured separately after migration.
- Dedicated */15 cron; existing */10 recovery and Arena bots remain unchanged.
- A Supabase atomic slot claim prevents duplicate crafts on cron retries; a completed slot is never replayed.
- Mixed strategy: random owned pairs are checked against built-in recipes and shared cached AI results. Curious turns prioritize undiscovered built-in recipes. No uncached text inference or paid text fallback.
- Shared craft application, normal rarity/copy/bonus rolls; 5,000-item and 8 MiB safety limits.
- One artwork attempt per slot, cached art first; pending art remains queued for future ticks. A dedicated 1,000-neuron counter is reserved atomically with the existing 10,000-neuron daily image ceiling. Failed calls retain their reservation. No external image providers or paid fallback. Both counters reset at midnight UTC. Other Cloudflare account usage is not covered by this image ledger.
- A scoped, server-only Bloop credential authorizes only the claim and finish RPCs. Prefer BLOOP_DB_TOKEN Worker secret; production can use a private KV value at boop:bloop:db-token:v1 (never expose it in client code or logs). Database stores only its SHA-256 verifier in non-exposed bloop_private.credentials. The RPC wrapper uses invoker rights; private helpers validate the credential before touching Bloop-only rows. Rotate both together.
- /api/bloop/status exposes only config and ledger counters. /api/bloop/art is cache-only and never generates artwork.
- Test: npm test and npm run lint; verify cron schedules, status and the new Bloop activity row after a scheduled tick.
