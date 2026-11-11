# Unique element values and Boop Coins

Every concept in the collection has a **deterministic in-game guide value**, not a real-money valuation. Version 2 expands the old 10–40 base-value range: every base price includes the normalized name's length and word complexity, its name-derived collection category, the shortest known canonical recipe depth (when available), and a deterministic name-identity bonus. These criteria are independent of device, player account, time, artwork, editable recipes, and the number of times an item is crafted.

The existing **rarity** (Common through Secret) and **finish** (Standard, Shiny, Holo, Celestial, Glitch) multipliers still apply. Unowned finishes cannot be sold or quoted as unlocked.

## Guarantee and limitations

`buildCollectionValueBook` calculates prices for every distinct normalized name and **all five forms** in the currently saved collection. It sorts proposed prices deterministically and resolves collisions by adding the smallest available whole-coin offset. Therefore no two distinct name/form pairs in that collection share a value, even when names have the same shape or hash. Case/whitespace/NFKC equivalents refer to one concept. Reordering or filtering the collection never changes prices.

The guarantee is **collection-scoped**, not that every possible future Unicode name across all players can have a globally unique bounded integer. A newly discovered colliding concept or upgraded rarity can reprice entries; prices are recalculated on load and are not frozen forever. This is why a sale always rechecks the latest price against the displayed quote before committing.

## Storage and selling

The value schedule has no new stored fields, no schema migration, no AI costs and no network dependency. Existing in-game wallets, sold-copy receipts, recipes, art, rarity unlocks and save version 3 are unchanged. **Already completed sales are never retroactively modified.** A successful sale atomically credits the server-checked-by-local-ledger price into the private Boop wallet only after checking earned copies, price, save state and integer overflow. This isn't a real-money market, and online trading would require authoritative server validation.

Collection cards, sorting, detailed price breakdowns and Craft/Dossier quotes share the same collection price book. The breakdown explains complexity, category, canonical recipe chain and name-identity bonus as well as the rarity and form multipliers. Any rare collision adjustment appears separately.

## Verification

`npm test`, `npm run lint`, `npm run build`, and the Android and viewport workflows must pass before deployment. Tests check determinism, rarity/finish multipliers, duplicate normalization, case-insensitive values, generated names, thousands of name/form pairs, collision resolution and sale proceeds.
