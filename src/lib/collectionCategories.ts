/**
 * One shared collection taxonomy for Craft, Kitchen, Foundry and legacy saves.
 * Classification is free and deterministic: opening the Collection never calls AI,
 * writes a save, or changes previously uploaded artwork.
 *
 * Existing recognized categories are reused; an unfamiliar subject creates a
 * reusable subject-family shelf rather than disappearing into Miscellaneous.
 */
export interface CategorizedDiscovery {
  name: string;
  category?: string;
  connection?: string;
  emoji?: string;
}

export const COLLECTION_CATEGORY_ORDER = [
  'Animals', 'Food & Drink', 'Plants & Nature', 'Weather & Climate',
  'Elements & Energy', 'Materials & Minerals', 'Science & Medicine',
  'Technology', 'Tools & Objects', 'Vehicles', 'Buildings & Structures',
  'Places & Geography', 'Space & Cosmos', 'People & Professions',
  'Characters', 'Brands', 'Pop Culture', 'Fantasy & Mythology',
  'Arts & Music', 'Language & Ideas', 'Oddkin & Creatures',
] as const;

const ALIASES: Record<string, string> = {
  animal: 'Animals', animals: 'Animals', fauna: 'Animals', wildlife: 'Animals',
  biology: 'Science & Medicine', biological: 'Science & Medicine', zoology: 'Animals',
  food: 'Food & Drink', edible: 'Food & Drink', culinary: 'Food & Drink', kitchen: 'Food & Drink',
  organic: 'Plants & Nature', botanical: 'Plants & Nature', botany: 'Plants & Nature',
  flora: 'Plants & Nature', plant: 'Plants & Nature', plants: 'Plants & Nature', ecology: 'Plants & Nature',
  weather: 'Weather & Climate', climate: 'Weather & Climate',
  elemental: 'Elements & Energy', energy: 'Elements & Energy', plasma: 'Elements & Energy',
  mineral: 'Materials & Minerals', metallic: 'Materials & Minerals', metal: 'Materials & Minerals',
  material: 'Materials & Minerals', materials: 'Materials & Minerals',
  chemistry: 'Science & Medicine', physics: 'Science & Medicine', science: 'Science & Medicine',
  medicine: 'Science & Medicine', medical: 'Science & Medicine',
  technology: 'Technology', electronics: 'Technology', engineering: 'Technology',
  tools: 'Tools & Objects', artifacts: 'Tools & Objects', artifact: 'Tools & Objects',
  transport: 'Vehicles', vehicle: 'Vehicles', vehicles: 'Vehicles',
  architecture: 'Buildings & Structures', building: 'Buildings & Structures',
  geography: 'Places & Geography', places: 'Places & Geography',
  cosmos: 'Space & Cosmos', space: 'Space & Cosmos',
  person: 'People & Professions', people: 'People & Professions', history: 'People & Professions',
  characters: 'Characters', character: 'Characters',
  brands: 'Brands', brand: 'Brands',
  'pop-culture': 'Pop Culture', 'pop culture': 'Pop Culture', culture: 'Pop Culture',
  mythology: 'Fantasy & Mythology', fantasy: 'Fantasy & Mythology', magical: 'Fantasy & Mythology',
  arts: 'Arts & Music', music: 'Arts & Music', art: 'Arts & Music',
  language: 'Language & Ideas', wordplay: 'Language & Ideas', comedy: 'Language & Ideas',
  oddkin: 'Oddkin & Creatures', creature: 'Oddkin & Creatures',
};

const GENERIC = new Set(['', 'all', 'discoveries', 'discovery', 'misc', 'miscellaneous', 'other',
  'uncategorized', 'unknown', 'concept', 'concepts', 'general', 'foundry',
  'function', 'appearance', 'rare variant', 'discovery trail']);
const PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Characters', /\b(?:pikachu|pokemon|pokémon|batman|superman|spiderman|spider-man|sonic|mario|luigi|kirby|zelda|link|yoshi|robotnik)\b/i],
  ['Food & Drink', /\b(?:food|pizza|burger|bread|cake|cookie|biscuit|taco|sushi|chocolate|coffee|tea|toast|pasta|noodle|soup|ice cream|gelato|strudel|sandwich|salad|pudding|pie|donut|doughnut|fruit|berry|apple|banana|lemon|steak|meal|dessert|drink|juice|cheese|candy|soda|smoothie|bento|feast|breakfast|dinner|lunch|syrup|croissant|waffle|pancake)\b/i],
  ['Animals', /\b(?:animal|cat|dog|wolf|fox|bear|lion|tiger|shark|whale|dolphin|octopus|squid|fish|bird|eagle|owl|sparrow|canary|bat|butterfly|bee|ant|bug|beetle|horse|cow|pig|sheep|goat|rabbit|mouse|rat|deer|moose|turtle|snake|frog|lizard|crocodile|dinosaur|pterodactyl|penguin|crab|lobster|spider|moth|otter|hedgehog|raccoon|panda|koala)\b/i],
  ['Oddkin & Creatures', /\b(?:oddkin|organism|mutant|chimera|abomination|cryptid)\b/i],
  ['Fantasy & Mythology', /\b(?:dragon|unicorn|phoenix|mermaid|vampire|werewolf|ghost|griffin|goblin|wizard|witch|fairy|troll|orc|elf|demon|angel|myth|spell|enchantment|magic|rune|kraken|leviathan)\b/i],
  ['Plants & Nature', /\b(?:plant|tree|flower|forest|jungle|swamp|moss|grass|vine|fern|rose|cactus|orchid|dandelion|mushroom|root|leaf|leaves|seed|bamboo|woodland|garden|algae|seaweed|shrub|blossom|flora)\b/i],
  ['Weather & Climate', /\b(?:rain|storm|hurricane|tornado|cloud|snow|blizzard|fog|mist|thunder|lightning|hail|rainbow|wind|typhoon|weather|monsoon|breeze|drought|aurora)\b/i],
  ['Space & Cosmos', /\b(?:planet|galaxy|universe|cosmos|cosmic|nebula|black hole|solar system|satellite|asteroid|meteor|comet|moon|star|constellation|spaceship|astronaut|rocket|sun)\b/i],
  ['Vehicles', /\b(?:car|truck|train|airplane|plane|helicopter|bus|boat|ship|submarine|scooter|bicycle|bike|motorcycle|tractor|vehicle|ferry|steamboat|van|taxi)\b/i],
  ['Buildings & Structures', /\b(?:house|castle|tower|bridge|wall|hut|cottage|building|school|hospital|lighthouse|temple|fortress|palace|skyscraper|hotel|factory|stadium|greenhouse|barn|cabin)\b/i],
  ['Places & Geography', /\b(?:city|village|town|island|continent|country|ocean|sea|river|lake|mountain|valley|desert|volcano|canyon|beach|coast|kingdom|metropolis|world|earth|switzerland|canada|japan)\b/i],
  ['Technology', /\b(?:robot|computer|laptop|phone|smartphone|radio|television|tv|internet|website|software|algorithm|ai|processor|battery|circuit|gadget|device|machine|laser|camera|console|arcade|server|electric|printer|drone|screen|hologram)\b/i],
  ['Science & Medicine', /\b(?:medicine|nurse|doctor|surgery|vaccine|cell|bacteria|virus|atom|molecule|protein|gene|dna|gravity|magnetism|chemistry|physics|laboratory|microscope|fossil|anatomy|neuron|enzyme|therapy|stethoscope)\b/i],
  ['Elements & Energy', /\b(?:water|fire|flame|lava|magma|steam|spark|energy|electricity|plasma|ice|wind|light|heat|cold|radiation|smoke|pressure)\b/i],
  ['Materials & Minerals', /\b(?:stone|rock|sand|clay|mud|soil|metal|iron|steel|copper|silver|gold|ore|crystal|diamond|ruby|sapphire|quartz|glass|obsidian|gem|gemstone|wood|plastic|ceramic|alloy|brick|salt|mineral)\b/i],
  ['Tools & Objects', /\b(?:tool|hammer|sword|axe|knife|wrench|drill|clock|lamp|lantern|key|bottle|table|chair|desk|sofa|bed|cabinet|chest|basket|book|bag|umbrella|guitar case|compass|telescope|hourglass|mirror|cup|vase)\b/i],
  ['Arts & Music', /\b(?:music|song|guitar|violin|piano|drum|harp|flute|painting|portrait|mural|sculpture|artwork|dance|theatre|concert|film|movie|album|poetry|comic)\b/i],
  ['People & Professions', /\b(?:human|person|engineer|teacher|chef|doctor|nurse|scientist|warrior|artist|pirate|sailor|soldier|farmer|pilot|king|queen|emperor|knight|child)\b/i],
  ['Language & Ideas', /\b(?:time|memory|dream|idea|language|word|thought|emotion|knowledge|paradox|philosophy|joke|pun|letter|alphabet|symbol)\b/i],
];

// Display-only additions leave name-based coin quotes on their existing taxonomy.
const DISPLAY_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Materials & Minerals', /\b(?:biochar|charcoal|carbon|ash|humus|compost)\b/i],
  ...PATTERNS,
];

/** Clean and reuse existing category names; reject sentences and filler labels. */
export function canonicalCollectionCategory(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const key = cleaned.toLocaleLowerCase('en');
  if (GENERIC.has(key) || cleaned.length > 36 || !/^[\p{L}\p{N} &/’'-]+$/u.test(cleaned)) return undefined;
  const existing = COLLECTION_CATEGORY_ORDER.find(label => label.toLowerCase() === key);
  if (existing) return existing;
  if (ALIASES[key]) return ALIASES[key];
  if (cleaned.split(' ').length > 4) return undefined;
  return cleaned.replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase('en'));
}

const CONNECTION_LABELS = new Set([
  'biology','ecology','chemistry','physics','science','technology','geography',
  'mythology','food','pop-culture','brand','character','history','language','comedy','kitchen',
]);

function familyForNovelConcept(name: string): string {
  const words = name.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];
  const word = words[words.length - 1]?.slice(0, 24);
  if (!word) return 'New Discoveries';
  const noun = word[0].toLocaleUpperCase('en') + word.slice(1).toLocaleLowerCase('en');
  if (words.length === 1) return noun + ' Family';
  if (noun.endsWith('s')) return noun;
  if (/[bcdfghjklmnpqrstvwxz]y$/i.test(noun)) return noun.slice(0,-1) + 'ies';
  if (/(?:ch|sh|x|z)$/i.test(noun)) return noun + 'es';
  return noun + 's';
}

/** Determine a shelf when first discovering an element (and for older saves).
 * New subject families emerge automatically without an extra AI call. */
export function categoryForDiscovery(item: CategorizedDiscovery): string {
  const explicit = canonicalCollectionCategory(item.category);
  if (explicit) return explicit;
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  // Classify the actual discovered object before its recipe's connection method.
  for (const [label, pattern] of PATTERNS) if (pattern.test(name)) return label;
  const hint = item.connection?.trim().toLowerCase();
  if (hint && CONNECTION_LABELS.has(hint)) return ALIASES[hint] || 'Language & Ideas';
  // Unknown but real concepts get a named family shelf that future items reuse.
  return familyForNovelConcept(name);
}

/** Improve older automatic family shelves in the collection view without changing saves or prices. */
export function collectionDisplayCategory(item: CategorizedDiscovery): string {
  const current = categoryForDiscovery(item);
  const name = typeof item.name === 'string' ? item.name.trim().normalize('NFKC') : '';
  // Keep custom shelves and intentional character/brand/creature identities.
  // Standard automatic labels can be corrected by the actual subject noun.
  const stored = canonicalCollectionCategory(item.category);
  const standard = COLLECTION_CATEGORY_ORDER.includes(stored as typeof COLLECTION_CATEGORY_ORDER[number]);
  if (stored && stored !== familyForNovelConcept(name) && !standard) return current;
  if (stored && ['Characters', 'Brands', 'Oddkin & Creatures'].includes(stored)) return current;
  const characterPattern = PATTERNS.find(([label]) => label === 'Characters')![1];
  if (characterPattern.test(name)) return 'Characters';
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  for (let i = words.length - 1; i >= 0; i--) {
    const subject = words.slice(i).join(' ');
    const matches = DISPLAY_PATTERNS.filter(([, pattern]) => pattern.test(subject));
    // Preserve an existing standard label when this same subject supports it.
    // This keeps intentionally ambiguous elements such as Wind stable.
    if (stored && matches.some(([label]) => label === stored)) return stored;
    if (matches.length) return matches[0][0];
  }
  return current;
}

export function collectionCategoryCounts<T extends CategorizedDiscovery>(items: readonly T[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = categoryForDiscovery(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({name,count}))
    .sort((a,b) => {
      const aa = COLLECTION_CATEGORY_ORDER.indexOf(a.name as typeof COLLECTION_CATEGORY_ORDER[number]);
      const bb = COLLECTION_CATEGORY_ORDER.indexOf(b.name as typeof COLLECTION_CATEGORY_ORDER[number]);
      return (aa<0?1000:aa)-(bb<0?1000:bb) || a.name.localeCompare(b.name);
    });
}
