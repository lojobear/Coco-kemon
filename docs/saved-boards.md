# Saved crafting boards

Use **Boards: …** beside Craft to open the board manager. Up to twelve named boards can be created, renamed, duplicated and switched. New boards start empty; every board can use the same shared discoveries. Each board stores its tiles, positions, pins and zoom. Duplicates are independent layouts.

The current legacy layout becomes Main board without moving or clearing its tiles. Switching boards clears ingredient selections, results and Undo/Redo history so one board cannot affect another. Board operations wait for crafting to finish and commit before the active board changes. Deleting requires confirmation, cannot remove the last board and never removes discoveries or coins.

Board sets are optional `savedBoards` metadata inside the existing version-3 game payload. They use the existing IndexedDB save queue and transaction failure/stale-tab protections, and are included in JSON exports and cloud saves. Older backups without board sets restore a single Main board using their saved layout; importing replaces the board set instead of retaining boards from the previous collection. The legacy layout/zoom remain mirrors of the active board for compatibility.

Validation covers bounded names and IDs, duplicate rejection, owned-element filtering, pins and zoom, migration, independent duplicates, switching, Undo isolation, reload, deletion, export/import, subsequent crafts preserving all boards and database failure leaving committed data unchanged. Browser checks run at 320/412/1440px.
