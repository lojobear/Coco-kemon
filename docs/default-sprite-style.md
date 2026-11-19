# Default sprite style

`DEFAULT_SPRITE_ART_STYLE` is `tactics`, the existing **Tactical Isometric** option. Automatic standard/shiny artwork requests, rerolls without an explicit style, client image normalization and Sprite Lab's initial selection use this shared default. Tactical artwork uses the existing 128px pixel pipeline and art direction.

Default server artwork cache identities include the style, separating new Tactical requests from the previous Classic default. Existing owned/local/profile artwork remains readable and is not automatically regenerated. Explicit Classic Boop and all other styles remain available; legacy unmarked Classic prompts retain their existing fallback handling.

Tests verify the default API prompt, shiny defaults, provider fallback art direction, cache deduplication, explicit Classic behavior and the Sprite Lab selection at 320/412/1440px without requesting image generation.
