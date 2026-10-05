# Google Play release checklist

QuarkPop now has an Android packaging workflow under `mobile/`.

## Before the first upload

1. Decide the permanent Android application ID. The default is `com.logaandavid.oddkinfoundry`.
2. Create a Google Play Console developer account if one is not already available.
3. Create the QuarkPop app entry in Play Console using the same application ID.
4. Create and securely back up an Android upload keystore.
5. Add the four Android signing secrets documented in `mobile/README.md`.
6. Run the GitHub Actions workflow **Android Play Bundle** with version code `1`.
7. Download the generated `.aab` artifact and upload it to an Internal testing release first.

## Store listing draft

**App name:** QuarkPop

**Short description:** Combine ideas, discover strange new elements, and build a growing collection of Oddkin.

**Category:** Game / Puzzle or Casual

**Core features:**
- infinite-style concept crafting
- AI-assisted discoveries
- collectible 3D emoji-style element art
- Oddkin creature collection
- photo and sketch seed tools
- local saves, backups, and optional cloud saves

## Release hygiene

- Increase `version_code` for every Play Console upload. Google Play rejects reused version codes.
- Keep the application ID unchanged after publishing.
- Test Google sign-in, camera/photo selection, sound, cloud saves, orientation, back navigation, and offline/error states on a physical Android device before production.
- Use Internal testing first, then Closed/Open testing as required by the Play account.
- Keep the production HTTPS app URL stable because the native shell loads that deployment.
