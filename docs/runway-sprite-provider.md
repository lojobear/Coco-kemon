# Optional Runway image generation in Boop

Runway and Runware are **separate companies** and need **different keys**.
This integration calls Runway Dev directly. It does not use a Runway
ChatGPT connection or require a key in browser code.

## Secure setup

1. In https://dev.runwayml.com/ create or inspect your developer API key
   (usually starts with `key_`). Add credits in Runway's developer portal
   if necessary. Runway charges for generated images.
2. Cloudflare dashboard → Workers & Pages → **coco-kemon** → **Settings →
   Variables and Secrets**. Create **RUNWAYML_API_SECRET** with Type **Secret**
   and paste your Runway Developer API key. **Never paste it in ChatGPT,
   GitHub, or a client-side environment variable.**
3. Set **RUNWAY_SPRITES_ENABLED** as a plain text variable with the value
   `1` to opt into Runway charges. Until this opt-in is set, **zero Runway
   credits** are used, even if the key is present.
4. Deploy the latest Worker version so the new binding is available.
5. In Boop, use **Retry** on pending art. Runway is asynchronous, so an
   in-progress sprite is retried automatically while the app is open.

The fallback order is: Cloudflare Workers AI → Runware (if valid) → Runway
(if explicitly enabled) → Gemini. Boop's existing combination results,
normal/shiny variants, local sprite storage, and shared sprite cache are
unchanged.

## Budget and model

Default image model: `muse_image` (Meta Muse Image offered through Runway);
currently **1 Runway credit per generated image**, subject to provider
pricing. Normal and shiny artworks are *separate* images and therefore
have separate charges. The client does not bulk-generate every element
automatically. Boop's retry queue is limited and respects quota failures.

## Reliability and security

Runway's `POST /v1/text_to_image` creates an asynchronous **task**;
`GET /v1/tasks/{id}` retrieves status. Boop keeps the task ID in the
existing `QUARKPOP_CACHE` KV and returns a retryable pending error while
Runway processes it. Reopening Boop asks for the *same* task's status;
it doesn't submit a fresh paid task for every poll. Failed/expired tasks
are not recreated automatically.

When a task succeeds, Boop downloads its **temporary** image URL server-side,
checks host, content type and size, converts it to image bytes for the
existing sprite pipeline, and stores the resulting art in its normal
caches. It never stores an expiring Runway URL as the collectible.

Do not remove `QUARKPOP_CACHE` KV: without it, the paid Runway integration
intentionally disables itself, to reduce repeat-spending risk. Cloudflare
KV is eventually consistent and does not provide a cross-region atomic
lock, so multiple concurrent regions can still rarely submit duplicate
tasks; keep a spending limit on your Runway project. Live connectivity
cannot be verified until the real API secret and opt-in are configured.

If Runway returns 401, confirm you entered a **Runway Dev** API key,
not a Runware key, and use Runway's developer portal to troubleshoot.
