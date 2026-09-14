# Google login and cloud saves

This adds a Supabase backend: Google OAuth sessions, a PostgreSQL backup table, and account-scoped access rules. Vercel continues hosting the game and Gemini API.

## Connect the backend

1. Create a Supabase project at https://supabase.com/dashboard. Review the selected plan before provisioning. In its SQL Editor, run `supabase/migrations/20260914030000_cloud_saves.sql` once. It creates the table, access policies, and atomic save function.
2. In Google Cloud / Google Auth Platform, configure the consent screen for Oddkin Foundry. Create a **Web application** OAuth client. Add `https://oddkin-foundry.vercel.app` to Authorized JavaScript origins. Add the Supabase callback URL shown under **Authentication → Sign In / Providers → Google** to Google's Authorized redirect URIs (normally `https://<project-ref>.supabase.co/auth/v1/callback`). Enable Google in Supabase using that client ID and client secret. If Google is in Testing mode, add your Google account as a test user.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://oddkin-foundry.vercel.app` and allow `https://oddkin-foundry.vercel.app/` as a redirect. Add the exact Vercel preview origin with a trailing slash when testing a preview. Local development uses `http://localhost:3000/`. Use exact allowed URLs rather than a wildcard for every Vercel site.
4. From Supabase's project connection/API settings, get the project URL and **publishable** key. In Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the environments you will use, then redeploy. Vite embeds these public values at build time. Never use a service-role key, secret key, Google client secret, or Gemini key in a `VITE_` variable. The Google client secret stays in Supabase's Google provider settings.

There is no service-role key in this app. Authentication and row-level security protect the publishable client. The database function derives ownership from the verified session and never accepts a user ID from the caller. Do not disable RLS or grant direct table writes.

## Player flow

- Open **Cloud save → Sign in with Google**. Login keeps existing device progress in place.
- **Save to cloud** uploads both game collections. Replacing an existing cloud collection asks for confirmation.
- On another device, sign into the same Google account and choose **Load from cloud**. Loading asks before replacing device progress and stores a local recovery copy first. Export that recovery copy from the Cloud saves panel if needed, then import it through Save Management.
- Device autosaving continues; cloud saves are explicitly manual. Save before switching devices. A revision conflict rejects the upload rather than silently overwriting another device's newer save. Refresh cloud info and deliberately choose to load or replace it.
- Sign-out leaves device progress on that browser. Accounts have separate cloud backups; local progress is shared by people using the same browser profile.
- Saves are capped at 8 MiB. Large custom images may reach the limit; JSON exports remain available. Database JSON text accounting may be slightly larger than the browser's compact JSON.

## Verification before production

Run `npm run lint`, `npm test`, and `npm run build`. Tests execute the actual migration in embedded PostgreSQL to check anonymous denial, account isolation, direct-write denial, and stale revision rejection.

After configuration, use the preview to sign in with Google, save a non-starter collection, sign out/in, and load it on a second browser. Verify both crafting and Foundry data, recovery export, cancelled login, and an offline save failure. Make concurrent saves on two devices and confirm a stale save is rejected. OAuth and the hosted database cannot be fully verified without a configured project.

References: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/database/postgres/row-level-security
