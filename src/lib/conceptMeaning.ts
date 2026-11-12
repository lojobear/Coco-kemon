/** Qualify only supported senses with clear context; never invent a second owned copy. */
const SENSES: Record<string, readonly (readonly [string, RegExp])[]> = {
  smoker: [['barbecue', /\b(?:barbecue|barbeque|bbq|brisket|grill|meat|wood chips|smoking food)\b/i], ['cigarettes', /\b(?:cigarette|cigarettes|tobacco|nicotine|smoking person)\b/i]],
  bass: [['fish', /\b(?:fish|fishing|lake|freshwater)\b/i], ['instrument', /\b(?:guitar|instrument|music|strings)\b/i]],
  mouse: [['computer', /\b(?:computer|cursor|click|usb)\b/i], ['animal', /\b(?:rodent|animal|cheese|mammal)\b/i]],
  bat: [['sports', /\b(?:baseball|cricket|sports|batter)\b/i], ['animal', /\b(?:mammal|animal|nocturnal|cave)\b/i]],
  crane: [['machine', /\b(?:construction|lifting|machine|hoist)\b/i], ['bird', /\b(?:bird|feathers|wetland)\b/i]],
  seal: [['animal', /\b(?:mammal|flippers|marine|animal)\b/i], ['stamp', /\b(?:wax|stamp|document|emblem)\b/i]],
  bank: [['finance', /\b(?:money|finance|loan|deposit)\b/i], ['river', /\b(?:river|shore|stream)\b/i]],
};
export function qualifiedConceptName(name: string, context = ''): string {
  const clean = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (/\([^()]+\)$/.test(clean)) return clean.replace(/\((?:barbeque|bbq)\)$/i, '(barbecue)').replace(/\(cigarette\)$/i, '(cigarettes)');
  const senses = SENSES[clean.toLowerCase()];
  if (!senses) return clean;
  const matching = senses.filter(([, pattern]) => pattern.test(context));
  return matching.length === 1 ? `${clean} (${matching[0][0]})` : clean;
}
export function displayConceptName(item: { name: string; explanation?: string; recipe?: { first: string; second: string } }): string {
  const qualified = qualifiedConceptName(item.name, [item.explanation, item.recipe?.first, item.recipe?.second].filter(Boolean).join(' '));
  return SENSES[qualified.toLowerCase()] ? `${qualified} (unspecified)` : qualified;
}
export function meaningCategory(name: string): string | undefined {
  const key = name.toLowerCase();
  if (/^(?:smoker \(barbecue\)|bass \(instrument\)|bat \(sports\)|seal \(stamp\))$/.test(key)) return key.startsWith('bass') ? 'Arts & Music' : 'Tools & Objects';
  if (/^(?:smoker \(cigarettes\))$/.test(key)) return 'People & Professions';
  if (/^(?:bass \(fish\)|mouse \(animal\)|bat \(animal\)|crane \(bird\)|seal \(animal\))$/.test(key)) return 'Animals';
  if (/^(?:mouse \(computer\)|crane \(machine\))$/.test(key)) return 'Technology';
  if (key === 'bank (river)') return 'Places & Geography';
  if (key === 'bank (finance)') return 'Buildings & Structures';
  const qualifier=key.match(/\(([^()]+)\)$/)?.[1];
  const categories: Record<string,string> = {
    animal:'Animals',bird:'Animals',fish:'Animals',snake:'Animals',
    computer:'Technology',programming:'Technology',software:'Technology',language:'Technology',
    instrument:'Arts & Music',music:'Arts & Music',color:'Arts & Music',
    food:'Food & Drink',fruit:'Food & Drink',coffee:'Food & Drink',
    person:'People & Professions',profession:'People & Professions',
    country:'Places & Geography',island:'Places & Geography',river:'Places & Geography',
    planet:'Space & Cosmos',element:'Materials & Minerals',metal:'Materials & Minerals',gemstone:'Materials & Minerals',
    mythology:'Fantasy & Mythology',god:'Fantasy & Mythology',
  };
  return qualifier ? categories[qualifier] : undefined;
}
