# Player profile

The profile summarizes the current device's saved collection. It includes discoveries, crafts, recipes, mastered items, shiny elements, unlocked special forms, categories explored and discoveries in the last seven local calendar days. Category and rarity breakdowns count distinct discoveries, excluding supplied starters.

Collection guide value quotes one best unlocked form per discovery using the shared value book. It is separate from wallet balance and does not imply that those forms or copies can all be sold. The most valuable list uses the same quotes.

Six milestones show progress toward discovery, craft, category and shiny goals. They are derived from saved records and award no coins. Recent discoveries use their discovery date, so recrafting an old item does not move it ahead of a new find.

Choose a featured discovery using the labeled selector. This preference stays on the device under `boop-profile-featured-discovery`; a forgotten or imported-away discovery is hidden automatically. Cloud display names and the existing trophy room remain available.

Download stats exports a JSON report without email or authentication data. It is a report, not a game-save backup. APK 3.3 uses Android's document picker through the trusted-origin native bridge; web browsers download the report normally.

Validation: `tests/board-profile.test.ts` covers aggregation and `tests/process-profile-smoke.mjs` checks profile rendering, featured discovery persistence, report contents and the Android bridge, plus selected-process dragging at 320, 412 and 1440px.
