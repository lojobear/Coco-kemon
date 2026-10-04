# Function-kitchen integration

Source: https://github.com/lojobear/Function-kitchen

ODDKIN reuses the original `lib/crafting-planner.ts` and the types, ideas,
starting inventory and tool catalogue from `constants.ts`. The constants retain
their Apache-2.0 SPDX notice. The integrated Kitchen uses ODDKIN's server-side
Gemini credentials, shared discovery collection, save/export/cloud-backup flow,
and sprite editor instead of introducing a separate Firebase account.

The Kitchen is a virtual crafting simulation. Local templates and AI-created
plans are explicitly distinguished. AI failures do not silently become successful
crafts. Each step checks its input dependencies before committing its output.
Recipes and intermediate discoveries are saved with the existing collection.

The original catalogue has an Apache-2.0 notice; the license text is in
`function-kitchen-LICENSE.txt`. Planner logic is adapted from the user-owned repository.
