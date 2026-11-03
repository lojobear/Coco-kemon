/**
 * O(1) random ingredient selection for the Discover screen.
 * No collection normalization or array allocation on each tap.
 * Always selects two different entries when possible.
 */
export function pickRandomPair<T>(
  pool: readonly T[],
  previous?: readonly [T, T] | null,
  random: () => number = Math.random,
): readonly [T, T] | null {
  const count = pool.length;
  if (count === 0) return null;
  if (count === 1) return [pool[0], pool[0]];

  const draw = (max: number) => Math.min(max - 1, Math.max(0, Math.floor(random() * max)));
  const firstIndex = draw(count);
  let secondIndex = (firstIndex + 1 + draw(count - 1)) % count;
  if (count > 2 && previous &&
      ((pool[firstIndex] === previous[0] && pool[secondIndex] === previous[1]) ||
       (pool[firstIndex] === previous[1] && pool[secondIndex] === previous[0]))) {
    secondIndex = (secondIndex + 1) % count;
    if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % count;
  }
  return [pool[firstIndex], pool[secondIndex]];
}
