# Meaningful processes

Non-Mix synthesis now includes a process contract using the authoritative action name, verb and description for all 500 actions. Every supplied ingredient must have a short factual contribution, and the response must identify the selected process and its effect. Responses missing a parent, claiming a different action or returning an unchanged parent are rejected before caching. A justified no-reaction remains valid. These checks enforce structure; semantic quality still depends on the model.

Groq, Workers AI and Gemini share the acceptance check and existing request deadline. Weak responses use the existing provider fallback rather than an additional critique call. Gemini concept planning requires strong input and process fit. Mix retains its current concept engine.

27 exact curated recipes add contrasting outcomes across Heat, Freeze, Ferment, Dry, Crush, Soak, Enchant and Fossilize. Examples: Milk becomes Hot Milk, Frozen Milk, Yogurt or Milk Powder; Milk + Chocolate becomes Hot Chocolate under Heat and Chocolate Ice Cream under Freeze. These are simplified game associations. Matching is an unordered multiset with exact arity, so a unary recipe cannot swallow a second ingredient. Existing canonical and expansion recipes take precedence.

New generated results use a versioned server cache to avoid reusing responses without the new contract. Saved local recipes, owned elements, artwork and lineage remain intact through the existing discovery reuse logic. This does not introduce hints, random selection changes or a journal. APK preview version: 3.10.

Validation: integration coverage for every new recipe and reversed binary inputs; process contracts for all 500 actions; malformed/missing contribution and wrong-action rejection; provider fallback with mocked Gemini responses; existing complete test suite.
