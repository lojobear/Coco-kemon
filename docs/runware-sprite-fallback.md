# Runware sprite fallback setup (Boop)

Boop now attempts image creation in this order:

1. Existing Cloudflare Workers AI image models, while the neuron allowance is available.
2. **Runware FLUX.2 [klein] 4B** (`runware:400@4`) when Cloudflare fails.
3. Configured Gemini image model if Runware is unavailable.

Successful art is cached using the existing element-sprite cache; images are requested
only for first-time discoveries and explicit rerolls, and `numberResults: 1` limits cost.
Runware renders 512x512 PNGs and returns base64 image data, so the existing
transparency-cleanup, image storage, and sprite display code remain unchanged.

## Activate your Runware API key (Cloudflare Workers)

Do **not** commit your API key or paste it into client code or chat.

1. Open the Cloudflare dashboard, then **Workers & Pages**.
2. Select the Worker named **coco-kemon**.
3. Open **Settings → Variables and Secrets → Add**.
4. Choose **Secret**, enter variable name **`RUNWARE_API_KEY`**, and enter your
   Runware API key as its value.
5. Click **Deploy** to apply the secret.
6. Deploy the latest GitHub `main` code to `coco-kemon`, if it is not already deployed.
7. In Boop **Sprites**, select a missing item and click **Retry missing art** to test.
   Only new artwork costs Runware credits. View errors in Worker logs if a test fails.

API key is read only on the server from `process.env.RUNWARE_API_KEY`
(Node.js compatibility is enabled in `wrangler.jsonc`). It never reaches the browser.

## Budget

Runware charges per image/model and may use promotional credits first.
Check your Runware dashboard for current balance and spending controls.
The default 512px FLUX.2 Klein configuration costs a tiny fraction of a dollar per
generation, but rates may change. Runware is optional: without the secret,
Boop uses the previous Cloudflare → Gemini image path.

Sources:
- https://runware.ai/docs/models-api/authentication
- https://runware.ai/docs/models/bfl-flux-2-klein-4b
- https://developers.cloudflare.com/workers/configuration/secrets/
