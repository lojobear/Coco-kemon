# Google login and cloud saves

This adds a Supabase backend: Google OAuth sessions, a PostgreSQL backup table, and account-scoped access rules. Vercel continues hosting the game and Gemini API.

## Connected project

The app defaults to the owner's Supabase project `lrjszbguvqgdsqvvcoqe` using its public publishable key. Vercel environment variables are optional overrides. The public key was verified against the Auth settings endpoint. At connection time, Google was disabled and `game_saves` was absent; complete steps 1–3 below before testing login or saves. No admin access is granted by this public key.

## Connect the backend

1. Create a Supabase project at https://supabase.com/dashboard. Review the selected plan before provisioning. In its SQL Editor, run `supabase/migrations/20260914030000_cloud_saves.sql` once. It creates the table, access policies, and atomic save function.
2. In Google Cloud / Google Auth Platform, configure the consent screen for Oddkin Foundry. Create a **Web application** OAuth client. Add `https://oddkin-foundry.vercel.app` to Authorized JavaScript origins. Add the Supabase callback URL shown under **Authentication → Sign In / Providers → Google** to Google's Authorized redirect URIs (normally `https://<project-ref>.supabase.co/auth/v1/callback`). Enable Google in Supabase using that client ID and client secret. If Google is in Testing mode, add your Google account as a test user.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://oddkin-foundry.vercel.app` and allow `https://oddkin-foundry.vercel.app/` as a redirect. Add the exact Vercel preview origin with a trailing slash when testing a preview. Local development uses `http://localhost:3000/`. Use exact allowed URLs rather than a wildcard for every Vercel site.
4. Optional, when changing projects: from Supabase's project connection/API settings, get the project URL and **publishable** key. In Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the environments you will use, then redeploy. Vite embeds these public values at build time. Never use a service-role key, secret key, Google client secret, or Gemini key in a `VITE_` variable. The Google client secret stays in Supabase's Google provider settings.

There is no service-role key in this app. Authentication and row-level security protect the publishable client. The database function derives ownership from the verified session and never accepts a user ID from the caller. Do not disable RLS or grant direct table writes.

## Player flow

- Open **Cloud save → Sign in with Google**. Login keeps existing device progress in place.
- **Save to cloud** uploads both game collections. Replacing an existing cloud collection asks for confirmation.
- On another device, sign into the same Google account and choose **Load from cloud**. Loading asks before replacing device progress and stores a local recovery copy first. Export that recovery copy from the Cloud saves panel if needed, then import it through Save Management.
- Device autosaving continues; cloud saves are explicitly manual. Save before switching devices. A revision conflict rejects the upload rather than silently overwriting another device's newer save. Refresh cloud info and deliberately choose to load or replace it.
- Sign-out leaves device progress on that browser. Accounts have separate cloud backups; local progress is shared by people using the same browser profile.
- Saves are capped at 8 MiB. Large custom images may reach the limit; JSON exports remain available. Database JSON text accounting may be slightly larger than the browser's compact JSON.

## Troubleshooting Google OAuth Errors

### 1. "localhost refused to connect" after signing in
This happens because Google authenticated successfully, but **Supabase** redirected you to `http://localhost:3000` instead of your live app URL.

When the live app URL is not listed in Supabase's **Redirect URLs**, Supabase rejects the redirect request and falls back to your configured **Site URL** (`http://localhost:3000`).

**How to fix:**
1. Go to your [Supabase Project Dashboard](https://supabase.com/dashboard/project/lrjszbguvqgdsqvvcoqe).
2. In the left navigation, click **Authentication** (shield icon) → **URL Configuration**.
3. Under **Site URL**, change it from `http://localhost:3000` to your actual app URL:
   ```text
   https://ais-dev-4hy3eczv46qkyckv6n6ic2-52292461097.us-east1.run.app
   ```
4. Under **Redirect URLs**, click **Add URL** and add each of the following:
   ```text
   https://ais-dev-4hy3eczv46qkyckv6n6ic2-52292461097.us-east1.run.app/**
   https://ais-dev-4hy3eczv46qkyckv6n6ic2-52292461097.us-east1.run.app/
   https://ais-pre-4hy3eczv46qkyckv6n6ic2-52292461097.us-east1.run.app/**
   https://oddkin-foundry.vercel.app/**
   http://localhost:3000/**
   ```
5. Click **Save**.
6. Now return to the app and click **Sign in with Google** again. Supabase will redirect directly back into the live app, complete the session, and show you signed in!

*(Tip: If you are currently stuck on the "localhost refused to connect" tab right now, look at the address bar: copy everything starting after `localhost:3000`, paste it onto `https://ais-dev-4hy3eczv46qkyckv6n6ic2-52292461097.us-east1.run.app`, and press Enter to instantly complete your login!)*

### 2. "Error 400: redirect_uri_mismatch"
This happens when the redirect URI that Supabase sends to Google is not listed in your Google Cloud OAuth Client credentials.
- In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
- Click on your OAuth 2.0 Client (Web application) with Client ID starting with `188587423044...`.
- Under **Authorized redirect URIs**, click **+ ADD URI** and add the exact Supabase callback URI:
  ```text
  https://lrjszbguvqgdsqvvcoqe.supabase.co/auth/v1/callback
  ```
  *(Important: Do not put your app URL here; Google must redirect back to Supabase's auth handler first).*
- Under **Authorized JavaScript origins**, add your app origins:
  - `https://lrjszbguvqgdsqvvcoqe.supabase.co`
  - `https://ais-dev-4hy3eczv46qkyckv6n6ic2-52292461097.us-east1.run.app`
  - `https://oddkin-foundry.vercel.app`
  - `http://localhost:3000`
- Click **Save**. Note: Google OAuth changes usually apply within 1–2 minutes.

### 2. "We're sorry but you don't have access" / "Error 403"
If Google shows **"We're sorry, but you don't have access"** or **"Access blocked: [App] has not completed the Google verification process"**:
1. **Consent Screen in Testing Mode (Most Common)**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **OAuth consent screen**.
   - Under **Test users**, click **+ ADD USERS** and enter your Google account email (`logaandavid@gmail.com`), then save.
   - Alternatively, under **Publishing status**, click **PUBLISH APP** to make it available to any user. Because the app only uses basic scopes (`email`, `profile`), Google app verification is not required.
2. **User Type set to "Internal"**:
   - In **OAuth consent screen**, ensure the User Type is **External**. Internal apps only allow users within an organization domain and block `@gmail.com` addresses.
3. **Allowed Redirect URLs in Supabase**:
   - In Supabase Dashboard → **Authentication** → **URL Configuration**, ensure your site origins are added under **Redirect URLs** (e.g. `https://ais-dev-4hy3eczv46qkyckv6n6ic2-52292461097.us-east1.run.app/**`, `http://localhost:3000/**`, `https://oddkin-foundry.vercel.app/**`).

## Verification before production

Run `npm run lint`, `npm test`, and `npm run build`. Tests execute the actual migration in embedded PostgreSQL to check anonymous denial, account isolation, direct-write denial, and stale revision rejection.

After configuration, use the preview to sign in with Google, save a non-starter collection, sign out/in, and load it on a second browser. Verify both crafting and Foundry data, recovery export, cancelled login, and an offline save failure. Make concurrent saves on two devices and confirm a stale save is rejected. OAuth and the hosted database cannot be fully verified without a configured project.

References: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/database/postgres/row-level-security
