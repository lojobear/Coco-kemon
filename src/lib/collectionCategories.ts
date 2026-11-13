import { meaningCategory, qualifiedConceptName } from './conceptMeaning.js';
/**
 * One shared collection taxonomy for Craft, Kitchen, Foundry and legacy saves.
 * Classification is free and deterministic: opening the Collection never calls AI,
 * writes a save, or changes previously uploaded artwork.
 *
 * Stable broad shelves take precedence over noisy old metadata. A novel family
 * appears only after three distinct owned concepts support it.
 */
export interface CategorizedDiscovery {
  name: string;
  category?: string;
  connection?: string;
  emoji?: string;
  explanation?: string;
  recipe?: {first:string;second:string};
}

export const COLLECTION_CATEGORY_ORDER = [
  'Animals', 'Food & Drink', 'Plants & Nature', 'Weather & Climate',
  'Elements & Energy', 'Materials & Minerals', 'Science & Medicine',
  'Technology', 'Tools & Objects', 'Vehicles', 'Buildings & Structures',
  'Places & Geography', 'Space & Cosmos', 'People & Professions',
  'Characters', 'Brands', 'Pop Culture', 'Fantasy & Mythology',
  'Arts & Music', 'Language & Ideas', 'Oddkin & Creatures',
] as const;

// Keep the original order above for historical v2 coin quotes. Display shelves
// can grow without changing anyone's prices or saved wallet.
export const DISCOVERY_CATEGORY_ORDER = [...COLLECTION_CATEGORY_ORDER,
  'Games & Toys','Sports & Recreation','Clothing & Accessories','Health & Wellness',
  'Business & Finance','Culture & Traditions','Education & Knowledge','Household & Decor',
  'Other Discoveries',
] as const;
export const FALLBACK_CATEGORY='Other Discoveries';
export const CATEGORY_PROMOTION_MIN=3;

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
export function legacyValueCategory(item: CategorizedDiscovery): string {
  const sense = meaningCategory(item.name);
  if(sense)return sense;
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


/** The main category system is deliberately independent of legacy value quotes.
 * Exact established identities first, then subject nouns, then reliable metadata.
 * A generic ingredient/modifier can never force an unrelated shelf. */
const EXTRA_ALIASES:Record<string,string>={
  game:'Games & Toys',games:'Games & Toys',gaming:'Games & Toys',toy:'Games & Toys',toys:'Games & Toys',
  sports:'Sports & Recreation',sport:'Sports & Recreation',recreation:'Sports & Recreation',
  fashion:'Clothing & Accessories',clothing:'Clothing & Accessories',accessories:'Clothing & Accessories',
  health:'Health & Wellness',wellness:'Health & Wellness',fitness:'Health & Wellness',
  business:'Business & Finance',finance:'Business & Finance',economics:'Business & Finance',
  traditions:'Culture & Traditions',religion:'Culture & Traditions',holiday:'Culture & Traditions',
  education:'Education & Knowledge',knowledge:'Education & Knowledge',
  household:'Household & Decor',decor:'Household & Decor',furniture:'Household & Decor',
  'food and drink':'Food & Drink','plants and nature':'Plants & Nature','weather and climate':'Weather & Climate',
  'materials and minerals':'Materials & Minerals','science and medicine':'Science & Medicine',
  'space and cosmos':'Space & Cosmos','places and geography':'Places & Geography',
  'tools and objects':'Tools & Objects','buildings and structures':'Buildings & Structures',
  'fantasy and mythology':'Fantasy & Mythology','arts and music':'Arts & Music',
  'people and professions':'People & Professions','elements and energy':'Elements & Energy',
  'language and ideas':'Language & Ideas','oddkin and creatures':'Oddkin & Creatures',
  'living things':'Plants & Nature','fictional characters':'Characters','fictional character':'Characters',
  'video games':'Games & Toys','video game':'Games & Toys','apparel':'Clothing & Accessories',
  'natural resources':'Materials & Minerals','minerals':'Materials & Minerals','metals':'Materials & Minerals',
  'chemical':'Science & Medicine','alchemy':'Science & Medicine','geology':'Materials & Minerals','geographical':'Places & Geography',
  'astronomy':'Space & Cosmos','invention':'Technology','inventions':'Technology','machinery':'Technology',
  'mechanical':'Technology','composite':'Materials & Minerals','synthetic':'Materials & Minerals',
  'biological organisms':'Science & Medicine','medical equipment':'Science & Medicine',
};
const normalizedName=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const standardCategory=(value:unknown):string|undefined=>{
 if(typeof value!=='string')return;
 const key=normalizedName(value).replace(/\s+and\s+/g,' & ');
 return DISCOVERY_CATEGORY_ORDER.find(label=>label.toLowerCase()===key)||EXTRA_ALIASES[key]||ALIASES[key];
};
const exactGroups:Record<string,string[]>={
 'Elements & Energy':['water','fire','earth','wind','air','spark','steam','ice','heat','cold','lava','plasma','energy','electricity','light','dust','smoke'],
 'Animals':['mouse','bat','crane','seal','glasswing','moon jelly','prism koi','eclipse koi','storm wren','ball lightning wren','sea lion','seahorse','sea horse','flying fish','squirrel','duck','flock','tadpole','chrysalis','caterpillar','dinosaur','woodpecker','jellyfish','insect','wildlife','aquatic life'],
 'Food & Drink':['hot dog','corn dog','grilled cheese','french toast','ice cream sandwich','ice cream','moon cake','mooncake','grilled fish','fish and chips','chicken nugget','chicken soup','cat food','dog food','bird food','milk','butter','honey','wheat','rice','corn','egg','popcorn','cheese curd','curds','ghee','margarine','vinegar','tomato','tomato paste','potato','french fries','potato wedges','bread dough','dough','stew','flatbread','gelatin','jelly','sugar','pepper','salted fish','toasted marshmallow','bananas foster','cottage cheese','herbal tea','fruit juice','cooked rice','water bottle'],
 'Characters':['pikachu','mario','luigi','kirby','zelda','link','yoshi','sonic','robotnik','batman','superman','spider-man','spiderman','spongebob','mickey mouse','donald duck','winnie the pooh','r2-d2','wall-e','doraemon','godzilla','mechagodzilla','olaf','goku','naruto','shrek','scooby-doo','darth vader','yoda','iron man','wonder woman','the joker','gengar','mew','mewtwo','charizard','eevee','squirtle','bulbasaur'],
 'Brands':['tim hortons','starbucks',"mcdonald's",'mcdonalds','nintendo','lego','nike','adidas','new balance','reebok','spotify','sony','apple inc','google','microsoft','aibo','tesla motors','samsung','coca-cola','pepsi','nvidia','playstation','xbox','sega','amazon','disney'],
 'Games & Toys':['minecraft','pokémon','pokemon','fortnite','tetris','roblox','monopoly','chess','checkers','puzzle','rubik cube','rubik’s cube','board game','video game','trading card','booster pack','action figure','plastic figurine','toy car','toy train','doll','gachapon','capsule toy','game controller','arcade game','playing card','jigsaw puzzle','dice'],
 'Pop Culture':['pizza planet','lolcat','keyboard cat','treasure island','ghostbuster','ghostbusters','toy story','star wars','frozen','the avengers','horror movie','meme','internet meme','viral video','star trek','marvel','dc comics'],
 'Fantasy & Mythology':['flying dutchman','haunted house','ghost ship','familiar','nightmare','reborn spirit','wardstone','mermaid','unicorn','dragon','ghost','vampire','phoenix','wizard','witch','fairy','goblin','sphinx','centaur','yeti','golem','werewolf','kraken','leviathan','spellbook'],
 'Technology':['computer mouse','mouse (computer)','cloud server','dark web','circuit board','internet','computer','robot','engine','gear','microgear','generator','diode','inverter','transformer','capacitor','toggle switch','photodiode','solar cell','radio receiver','radio wave','audio signal','radar dish','wireless charger','optical fiber','fiber optic','magnetic tape','induction coil','hydraulic jack','air cylinder','pressure gauge','diffraction grating','time machine','typewriter','calculator','smartwatch','electric grill','laser','electrophoresis','programming','software'],
 'Materials & Minerals':['biochar','charcoal','carbon','ash','humus','compost','pebble','sandstone','limestone','gravel','obsidian','clay','mud','soil','brick','metal','glass','wood','plastic','resin','rubber','silk','cotton','fiber','wool','fabric','leather','paper','salt','salt crystal','concrete','grout','alloy','amalgam','chrome plating','nanofiber','polymer','aurora glass','thunder egg','opal mist','metal filings','metal coating','hardened steel','polished steel','fused glass','wet clay','anhydrous salt','wood veneer','plywood','patina','silver tarnish','seasoned timber','cured concrete','resin wood','treated timber','fractured rock','charcoal briquette'],
 'Science & Medicine':["schrödinger's cat","schrodinger's cat",'fossil','fern fossil','dinosaur skeleton','microbe','neuron','cell','life','death','dna','protein','atom','molecule','enzyme','prism','rainbow prism','chromatogram','alkene','fruit ester','electrophoresis','microscope','stethoscope','vaccine','antibiotic','syringe','tablet','thermometer','x-ray','experiment','plant cutting','mycorrhiza','hydroponics','aquaponics','aeroponics','archaeology','black hole'],
 'Plants & Nature':['bonsai','topiary','coral','coral reef','lunar garden','blue moon orchard','plant','tree','forest','flower','mushroom','seed','sapling','garden','orchard','woodland','sunflower','onion','root','seed pod','taproot','climbing tendril','climbing vine','pollinated flower','glowing mushroom','bioluminescent plant','wild berries','plant pellets'],
 'Weather & Climate':['cloud','rain','thunderstorm','snow','snowflake','rainbow','storm','fog','mist','hail','lightning','tornado','hurricane','blizzard','aurora','monsoon','drought'],
 'Vehicles':['fire truck','snowplow','pirate ship','titanic','ambulance','sailboat','sailing ship','road bike','racing car','train','motorcycle','space shuttle','spaceship','rocket','helicopter','submarine','diving bell'],
 'Buildings & Structures':['birdhouse','lighthouse','greenhouse','treehouse','farmhouse','house','wall','bridge','castle','barn','school','hospital','factory','stadium','bank','airlock','expansion joint','mortise joint','dovetail joint','laser joint'],
 'Places & Geography':['ocean','sea','river','lake','island','continent','mountain','land','country','canada','japan','ontario','kingston','toronto','volcano','desert','beach','farm','swamp','pond','city','village','kingdom','tide','waterfall'],
 'Space & Cosmos':['moon','sun','star','planet','space','galaxy','universe','cosmos','eclipse','asteroid','comet','nebula','constellation','solar system','black hole','satellite','moonwalk'],
 'People & Professions':['doctor','nurse','physician','scientist','human','person','firefighter','programmer','astronaut','pilot','sailor','pirate','castaway','farmer','chef','teacher','family','engineer','plumber','clown','artist','king','queen'],
 'Arts & Music':['hound dog','wind chime','song','music','guitar','piano','bass (instrument)','film','claymation','time lapse film','restored film','ink painting','marquetry','wood mosaic','relief sculpture','paper sculpture','laser engraving','photograph','portrait','painting','comic','book','novel','poem','album','sculpture'],
 'Tools & Objects':['box','bird nest','sea lantern','snow globe','snowman','treasure','hourglass','clock','reverse clock','calendar','time capsule','time capsule note','notebook','diary','history book','ancient map','ancient relic','mirror','beveled mirror','thermos','spindle','keyway','bolt','threaded nut','screw hole','precision bushing','knurled knob','stone bead','bimetal strip','water jet','pressure gauge','plastic bottle','plastic tank','plastic tray','sealed pouch','shrink wrap','metal shell','metal coating','glazed pottery','paper sculpture','dreamcatcher','screwdriver','toolbox'],
 'Household & Decor':['birdhouse','picture frame','wicker basket','plant hanger','rug','quilt','felt pad','vase','candle','furniture','sofa','couch','chair','table','bed','cabinet','desk','curtain','pillow','blanket','carpet','lamp','bowl','cup','plate','mug','jar'],
 'Clothing & Accessories':['shoe','sneaker','boot','shirt','t-shirt','pants','jeans','jacket','coat','dress','hat','cap','socks','glove','scarf','belt','necklace','bracelet','ring','watch','handbag','backpack','leather strap','crochet lace','dyed cloth','bleached cloth','tanned leather'],
 'Sports & Recreation':['hockey','basketball','baseball','football','soccer','tennis','golf','boxing','ufc','mma','skateboard','skateboarding','skiing','snowboarding','surfing','swimming','bicycle race','hockey puck','hockey stick','basketball hoop','tennis racket','baseball bat','soccer ball','sports ball','stadium sport'],
 'Health & Wellness':['exercise','meditation','sleep','yoga','fitness','stretching','first aid','massage','nutrition','hygiene','soap','sunscreen','toothbrush','toothpaste','shampoo'],
 'Business & Finance':['money','coin','currency','cash','banknote','budget','loan','stock market','bitcoin','cryptocurrency','investment','insurance','market','economy','company','corporation','business'],
 'Culture & Traditions':['christmas','halloween','easter','diwali','hanukkah','festival','holiday','wedding','birthday','tradition','religion','folklore','ceremony','road trip'],
 'Education & Knowledge':['education','math','mathematics','schoolwork','homework','textbook','dictionary','encyclopedia','knowledge','lesson','quiz','exam','degree','research'],
 'Language & Ideas':['cloud nine','joy','time','memory','dream','idea','emotion','thought','paradox','philosophy','joke','pun','word','letter','alphabet','symbol','love','fear','happiness','hope','luck','night','day','horoscope','road trip'],
};
const exact=new Map<string,string>();
// First defined identity wins; specific corrections below are deliberate.
for(const [category,names] of Object.entries(exactGroups))for(const name of names)if(!exact.has(name))exact.set(name,category);
for(const [name,category] of Object.entries({'black hole':'Space & Cosmos','water bottle':'Tools & Objects','birdhouse':'Buildings & Structures','road trip':'Culture & Traditions','paper sculpture':'Arts & Music','electrophoresis':'Science & Medicine','pressure gauge':'Technology','metal coating':'Materials & Minerals','moonwalk':'Arts & Music'}))exact.set(name,category);

// Strong terminal subjects. Check the longest suffix first, not the first
// matching word of the whole name (Cloud Server, Moon Cake, Fire Truck).
const SUBJECTS:ReadonlyArray<readonly [string,RegExp]>=[
 ['Games & Toys',/^(?:game|games|toy|toys|figurine|figurines|puzzle|puzzles|dice|controller|booster pack|trading cards?)$/i],
 ['Sports & Recreation',/^(?:sport|sports|puck|racket|rackets|skateboard|skates|snowboard|surfboard|tournament|boxing|wrestling|hockey stick|baseball bat)$/i],
 ['Clothing & Accessories',/^(?:shoe|shoes|sneaker|sneakers|boot|boots|shirt|shirts|jacket|jackets|coat|coats|dress|dresses|hat|hats|glove|gloves|scarf|scarves|belt|belts|necklace|bracelet|earrings?|handbag|backpack|socks|jeans|pants|tunic|armor|armour|helmet)$/i],
 ['Business & Finance',/^(?:money|coins?|currency|banknote|loan|loans|budget|investment|insurance|finance|stock market|business|corporation|company|cryptocurrency)$/i],
 ['Health & Wellness',/^(?:exercise|meditation|yoga|fitness|massage|soap|shampoo|sunscreen|toothpaste|toothbrush|hygiene)$/i],
 ['Household & Decor',/^(?:rug|quilt|pillow|blanket|curtain|carpet|sofa|couch|chair|table|bed|cabinet|desk|vase|bowl|mug|cup|candle|basket|furniture|picture frame)$/i],
 ['Education & Knowledge',/^(?:textbook|dictionary|encyclopedia|lesson|quiz|exam|homework|education|research)$/i],
 ['Culture & Traditions',/^(?:holiday|festival|ceremony|tradition|wedding|birthday|religion)$/i],
 ['Food & Drink',/^(?:milk|butter|honey|wheat|rice|corn|eggs?|dough|stew|flatbread|popcorn|curds?|ghee|vinegar|tomato|potato|fries|sugar|marshmallows?|pastry|pastries|muffins?|sauces?|jam|jelly|gelatin|cheesecake|bacon|sausage|pretzel|bagel|cereal|yogurt|yoghurt|noodles|sauce|pulp|sandwiches|cakes|cookies|berries|fish fillet)$/i],
 ['Animals',/^(?:squirrels?|ducks?|caterpillars?|chrysalis|jellyfish|woodpeckers?|tadpoles?|flock|herd|insects?|turtles?|penguins?|foxes|wolves|bears|birds|cats|dogs|fish|bees)$/i],
 ['Plants & Nature',/^(?:bonsai|topiary|sapling|saplings|orchard|orchards|coral|reef|fungi|fungus|mushrooms|seeds|flowers|trees|vines|tendril|tendrils|sunflower|onion|grass|berries|pollen)$/i],
 ['Technology',/^(?:engine|engines|motor|motors|gear|gears|generator|diode|inverter|transformer|capacitor|switch|photodiode|sensor|receiver|charger|router|server|circuit|circuit board|chip|microchip|microprocessor|radar|antenna|software|keyboard|monitor|controller|console|printer|nanobot|android|robot|automaton|computer|machine|turbine|device|hydraulic jack|air cylinder|optical fiber|fiber optic|radio wave)$/i],
 ['Materials & Minerals',/^(?:biochar|charcoal|carbon|ash|humus|compost|pebbles?|gravel|sandstone|limestone|resin|rubber|silk|cotton|fiber|wool|fabric|leather|paper|concrete|grout|alloy|amalgam|polymer|nanofiber|coating|plating|filings|timber|veneer|plywood|steel|patina|tarnish|briquette|solvent|solvents|mineral|crystals|gems|stones|rocks|metals|plastics)$/i],
 ['Science & Medicine',/^(?:fossils?|skeleton|microbe|microbes|syringe|thermometer|tablet|antibiotic|prism|chromatogram|ester|alkene|cell|cells|enzyme|molecule|atom|chemical|vaccine|diagnosis|disease|surgery|medicine|medication|laboratory)$/i],
 ['People & Professions',/^(?:doctor|nurse|physician|scientist|teacher|programmer|firefighter|astronaut|pilot|sailor|pirate|castaway|farmer|chef|engineer|plumber|clown|artist|king|queen|human|person|family|profession|worker|merchant|student|dentist|lawyer)$/i],
 ['Tools & Objects',/^(?:box|boxes|bottle|bottles|jar|jars|tray|pouch|wrap|spindle|bolt|nut|bushing|knob|hole|keyway|screw|bead|beads|joint|jack|gauge|lantern|globe|thermos|clock|calendar|capsule|notebook|diary|map|relic|mirror|screwdriver|hammer|toolbox|utensil|tools|tool|pottery|container|nest|hook|hinge|lock)$/i],
 ['Arts & Music',/^(?:song|songs|music|instrument|film|films|movie|movies|painting|paintings|sculpture|sculptures|mosaic|engraving|photo|photos|photograph|portrait|poem|poems|novel|novels|comic|comics|book|books|album|albums|chime|chimes|guitar|piano|melody|symphony|orchestra|dance)$/i],
 ['Vehicles',/^(?:snowplow|ambulance|sailboat|spaceship|rocket|shuttle|truck|trucks|car|cars|train|trains|boat|boats|ship|ships|bikes|motorcycles|aircraft|airplane|helicopter|submarine|tractor|vehicle|vehicles|scooter|bus|ferry|van|taxi)$/i],
 ['Buildings & Structures',/^(?:birdhouse|treehouse|farmhouse|house|houses|wall|walls|bridge|bridges|castle|castles|barn|school|hospital|factory|stadium|tower|towers|temple|fortress|palace|hotel|greenhouse|cabin|airlock)$/i],
 ['Places & Geography',/^(?:ocean|sea|river|lake|island|islands|continent|country|mountain|mountains|land|volcano|desert|beach|farm|swamp|pond|city|village|kingdom|waterfall|tide|valley|canyon|coast|town|world)$/i],
 ['Space & Cosmos',/^(?:moon|moons|sun|star|stars|planet|planets|space|galaxy|galaxies|universe|cosmos|eclipse|asteroid|comet|nebula|constellation|satellite)$/i],
 ['Weather & Climate',/^(?:cloud|clouds|rain|thunderstorm|snow|snowflake|rainbow|storm|storms|fog|mist|hail|lightning|tornado|hurricane|blizzard|aurora|monsoon|drought|weather|climate)$/i],
 ['Fantasy & Mythology',/^(?:ghost|ghosts|dragon|dragons|unicorn|unicorns|phoenix|vampire|vampires|wizard|witch|fairy|fairies|goblin|goblins|spirit|spirits|demon|angel|spell|spells|rune|runes|monster|monsters|creature|creatures|sphinx|golem|kraken|leviathan)$/i],
 ['Language & Ideas',/^(?:idea|ideas|thought|thoughts|memory|memories|dream|dreams|emotion|emotions|knowledge|paradox|philosophy|joke|jokes|pun|word|words|letter|letters|symbol|symbols|time|joy|fear|hope|luck)$/i],
];
const subjectPattern=(name:string):string|undefined=>{
 const words=name.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)||[];
 for(let i=Math.max(0,words.length-3);i<words.length;i++){
   const suffix=words.slice(i).join(' ');
   const known=exact.get(suffix);
   if(known)return known;
   for(const [category,pattern] of SUBJECTS)if(pattern.test(suffix))return category;
   // The original dictionary is useful for a single final subject, never a
   // modifier in the middle. For instance Gold Dragon remains Fantasy.
   if(i===words.length-1)for(const [category,pattern] of DISPLAY_PATTERNS)if(pattern.test(suffix))return category;
 }
};
const protectedIdentity=new Set(['Characters','Brands','Oddkin & Creatures','Pop Culture']);
const EMOJI_SHELVES:Record<string,string>={
 '🐿️':'Animals','🦡':'Animals','🦉':'Animals','🐼':'Animals','🐱':'Animals','🐈':'Animals','🐕':'Animals','🐟':'Animals','🐠':'Animals','🐦':'Animals','🦆':'Animals','🐻':'Animals','🦊':'Animals','🦋':'Animals','🐝':'Animals','🦖':'Animals','🐾':'Animals',
 '🍕':'Food & Drink','🍔':'Food & Drink','🍞':'Food & Drink','🍰':'Food & Drink','🍦':'Food & Drink','☕':'Food & Drink','🥐':'Food & Drink','🍜':'Food & Drink','🍎':'Food & Drink','🥤':'Food & Drink','🧀':'Food & Drink',
 '🌱':'Plants & Nature','🌿':'Plants & Nature','🌳':'Plants & Nature','🌸':'Plants & Nature','🌻':'Plants & Nature','🍄':'Plants & Nature',
 '⚡':'Elements & Energy','🔥':'Elements & Energy','💧':'Elements & Energy','🪨':'Materials & Minerals','💎':'Materials & Minerals','🧱':'Materials & Minerals',
 '🤖':'Technology','💻':'Technology','🖥️':'Technology','📱':'Technology','🚗':'Vehicles','🚂':'Vehicles','✈️':'Vehicles','🚢':'Vehicles','🚀':'Vehicles',
 '🏠':'Buildings & Structures','🏰':'Buildings & Structures','🌍':'Places & Geography','🏝️':'Places & Geography','🌙':'Space & Cosmos','🪐':'Space & Cosmos','🌌':'Space & Cosmos',
 '🎸':'Arts & Music','🎹':'Arts & Music','🎵':'Arts & Music','🎮':'Games & Toys','🧩':'Games & Toys','🎲':'Games & Toys','🏀':'Sports & Recreation','⚽':'Sports & Recreation','🏒':'Sports & Recreation',
 '👟':'Clothing & Accessories','👕':'Clothing & Accessories','🧢':'Clothing & Accessories','💰':'Business & Finance','👻':'Fantasy & Mythology','🐉':'Fantasy & Mythology',
};
/** A single stable shelf for a discovery, including newly saved metadata.
 * Ambiguous legacy names are qualified from their own explanation/recipe only.
 * No AI, no data writes, and no automatic singleton shelves. */
export function categoryForDiscovery(item:CategorizedDiscovery):string {
 const name=normalizedName(item.name||'');
 const qualified=qualifiedConceptName(name,[item.explanation,item.recipe?.first,item.recipe?.second].filter(Boolean).join(' '));
 const sense=meaningCategory(qualified);
 if(sense)return sense;
 const known=exact.get(name);
 if(known)return known;
 const explicit=standardCategory(item.category);
 const hint=standardCategory(item.connection);
 // A named character/brand connection is stronger than an incidental noun,
 // but a stale stored Characters/Brands shelf alone cannot mislabel a clear subject.
 if(hint&&protectedIdentity.has(hint))return hint;
 if(explicit==='Oddkin & Creatures')return explicit;
 const subject=subjectPattern(name);
 if(subject)return subject;
 // Only genuinely meaningful subject metadata, not legacy arbitrary shelves.
 if(explicit&&explicit!==FALLBACK_CATEGORY)return explicit;
 // Connection labels describe *how* an element was discovered, not always
 // what it is. Wordplay/comedy/function are not classification evidence.
 if(hint&&hint!==FALLBACK_CATEGORY&&!['wordplay','comedy','function','appearance','language'].includes(normalizedName(item.connection||'')))return hint;
 if(item.emoji&&EMOJI_SHELVES[item.emoji])return EMOJI_SHELVES[item.emoji];
 return FALLBACK_CATEGORY;
}
export function collectionDisplayCategory(item:CategorizedDiscovery):string {
 return categoryForDiscovery(item);
}

const GENERIC_HEADS=new Set(['thing','things','item','items','object','objects','name','names','concept','concepts','family','families','discovery','discoveries','element','elements','form','forms','type','types','variant','variants','stuff','unknown','new','misc','other','artifact','artifacts','specimen','specimens']);
/** For unknown objects only, derive a shared noun-family candidate. Do not
 * create singleton categories from a made-up one-word name or a number. */
function newFamily(item:CategorizedDiscovery):string|undefined {
 const clean=normalizedName(item.name||'').replace(/\s*\([^()]+\)$/,'');
 const words=clean.match(/[\p{L}]+/gu)||[];
 if(words.length<2||/\d$/.test(clean))return;
 const head=words[words.length-1];
 if(head.length<3||head.length>24||GENERIC_HEADS.has(head))return;
 const family=familyForNovelConcept(clean);
 return standardCategory(family)?undefined:family;
}
function customFamily(item:CategorizedDiscovery):string|undefined {
 const label=canonicalCollectionCategory(item.category);
 if(!label||standardCategory(label)||normalizedName(label)===normalizedName(familyForNovelConcept(item.name||'')))return;
 if(/ family$/i.test(label)||GENERIC_HEADS.has(normalizedName(label)))return;
 return label;
}
export type CollectionCategoryIndex=ReadonlyMap<string,string>;
/** Contextual category promotion uses the complete owned collection, not a
 * filtered search result or the number of duplicates. Stable under reorder.
 * Unknown categories only graduate with three distinct concepts. */
export function buildCollectionCategoryIndex(items:readonly CategorizedDiscovery[]):CollectionCategoryIndex {
 const unique=new Map<string,CategorizedDiscovery>();
 for(const item of items){const key=normalizedName(item.name||'');if(key&&!unique.has(key))unique.set(key,item);}
 const primary=new Map<string,string>();
 const custom=new Map<string,Set<string>>(),families=new Map<string,Set<string>>();
 const customLabels=new Map<string,string>(),familyLabels=new Map<string,string>();
 const add=(pool:Map<string,Set<string>>,labels:Map<string,string>,label:string|undefined,key:string)=>{
   if(!label)return;
   const normalized=normalizedName(label);
   const set=pool.get(normalized)||new Set<string>();set.add(key);pool.set(normalized,set);
   const prior=labels.get(normalized);if(!prior||label<prior)labels.set(normalized,label);
 };
 for(const [key,item] of unique){
   const category=categoryForDiscovery(item);primary.set(key,category);
   if(category!==FALLBACK_CATEGORY)continue;
   add(custom,customLabels,customFamily(item),key);add(families,familyLabels,newFamily(item),key);
 }
 // Choose a candidate, then check actual assigned size. If overlapping
 // custom labels remove members from a family, don't expose a tiny shelf.
 const proposed=new Map<string,string>();
 for(const [key,item] of unique){
   if(primary.get(key)!==FALLBACK_CATEGORY)continue;
   const c=customFamily(item),f=newFamily(item);
   const ck=c?normalizedName(c):'',fk=f?normalizedName(f):'';
   if((custom.get(ck)?.size||0)>=CATEGORY_PROMOTION_MIN)proposed.set(key,customLabels.get(ck)!);
   else if((families.get(fk)?.size||0)>=CATEGORY_PROMOTION_MIN)proposed.set(key,familyLabels.get(fk)!);
 }
 const actual=new Map<string,number>();
 for(const label of proposed.values())actual.set(label,(actual.get(label)||0)+1);
 for(const [key,label] of proposed)if((actual.get(label)||0)>=CATEGORY_PROMOTION_MIN)primary.set(key,label);
 return primary;
}
export function indexedCategory(item:CategorizedDiscovery,index:CollectionCategoryIndex):string {
 return index.get(normalizedName(item.name||''))||categoryForDiscovery(item);
}
export function collectionCategoryCounts<T extends CategorizedDiscovery>(items:readonly T[],index:CollectionCategoryIndex=buildCollectionCategoryIndex(items)) {
 const counts=new Map<string,number>();const seen=new Set<string>();
 for(const item of items){
   const key=normalizedName(item.name||'');if(!key||seen.has(key))continue;seen.add(key);
   const label=indexedCategory(item,index);counts.set(label,(counts.get(label)||0)+1);
 }
 const rank=(name:string)=>name===FALLBACK_CATEGORY?9999:DISCOVERY_CATEGORY_ORDER.indexOf(name as typeof DISCOVERY_CATEGORY_ORDER[number])<0?1000:DISCOVERY_CATEGORY_ORDER.indexOf(name as typeof DISCOVERY_CATEGORY_ORDER[number]);
 return [...counts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>rank(a.name)-rank(b.name)||a.name.localeCompare(b.name));
}
