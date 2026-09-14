# Discovery expansion

## Try it

Open Elements → Discovery trails. Choose Storm Chasers, Glass Menagerie or Moonlit Tides. Reveal ingredients if needed, then Prepare combination and tap Combine. The three trails contain 16 steps in total, including seven new combinations. Existing recipes take precedence. Progress is calculated from your saved collection, so importing a backup or loading a cloud save restores progress without another database migration.

Steam, Glass, Storm Wren, Prism Koi and Lunar Garden each have a 5% chance per successful craft to award a named rare bonus. The ordinary result always remains yours. Bonuses are labeled “Rare” in the collection and identify their original form in the dossier. They have their own names and can be used as ingredients. They are distinct from existing shiny forms and require no extra Gemini call. No pity counter or paid mechanics are included.

Foundry gains Fossilize, Enchant, Miniaturize and Moonlight. Ferment already existed and remains available. Older saves automatically receive the new processes while preserving previously earned unlocks. Four starter recipes work without Gemini: Plant → Fossilize → Fern Fossil; Stone → Enchant → Wardstone; Metal → Miniaturize → Microgear; Water → Moonlight → Moon Dew. Unknown recipes still use Gemini.

## Generation

Unknown element pairs ask Gemini for up to three candidates spanning science, function, appearance, mythology or wordplay in a single request. Candidates need a short connection explanation, coherence of 4–5 and surprise of 1–5. The server rejects literal concatenations and unchanged inputs, then ranks remaining candidates by 3 × coherence + surprise. These scores are model self-assessments, not an independent fact checker. Legacy single-result model output remains supported. Failures still produce retry messages, never synthetic success. The two-attempt request limit is unchanged.

Foundry sends an inheritance contract derived from parent properties, colors and process. Accepted creatures receive both parents’ traits, inherited palette colors and property-based locomotion. The pixel renderer draws frills, facets, plating, veins and lunar markings when their inherited traits apply. These are procedural pixel details, not generated image assets. Creature emergence must satisfy the existing server-side life-potential rules. Existing saved creatures are not regenerated.

## Validation and limitations

18 automated tests pass, covering trail reachability, canonical consistency, variant probability boundaries and backup preservation, candidate filtering, old-save process migration, inheritance, new API recipes, cloud database isolation and the plain-Node Vercel entrypoint. TypeScript and the production/PWA build pass; the existing large-bundle warning remains.

The available browser could not reach the local server, so mobile visual interaction still needs preview testing. Live Gemini quality has not been sampled here. The runtime recipe cache remains temporary server memory; this change does not add a shared permanent recipe database. Cloud login configuration is unchanged.
