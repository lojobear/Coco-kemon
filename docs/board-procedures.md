# Board procedures

Craft now starts with the board and a compact two-slot composer. Tap two board pieces, or tap each ingredient slot to choose from the library, then press Combine. A matching board piece is reused when available; choosing the same discovery twice uses distinct pieces. Keyboard selection works through the same buttons. The procedure controls open in a drawer above the composer and close after choosing or applying a procedure. Random stays on the board beside More tools.

Select one or two pieces, choose a procedure, then press Apply. Mix needs two pieces and uses the normal Craft engine. Other procedures use the existing Foundry synthesis engine directly; a successful result replaces the selected pieces on the board and joins the shared collection. Failed and no-reaction attempts keep the pieces. Undo restores board placement without removing earned discoveries.

The full procedure picker supports search and category filtering. Star a procedure to pin it; the first six favorites and six recent actions are shown near the board. All favorites remain accessible through the picker. Preferences are saved locally on the device under `boop-procedure-preferences-v1`.

Random pair adds two discoveries from the current random filters, selects them, and switches to Mix without running a recipe. The normal Random button keeps the configured batch size. Random pair is disabled when fewer than two board slots remain.

Tidy uses rendered tile dimensions, including wrapped names, to lay out rows in the current viewport. It reduces zoom down to the existing 60% minimum when that allows the board to fit. Larger boards continue in reachable vertical rows, with a message to pan down; no pieces are discarded. The world grows vertically when needed.

Validation: `npm test`, `npm run lint`, `npm run build`, and `node tests/procedures-smoke.mjs` with a running app on port 3000. The browser test uses deterministic mocked synthesis responses and covers cached results, copy accounting, failure/no-reaction retries, favorites/recent persistence, Random pair, and Tidy at 320/412/1440px. Set `BOOP_BASE_URL`, `CHROMIUM_PATH` or `BOOP_AUDIT_OUTPUT` when needed.
