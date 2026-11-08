import type { SpriteInventoryItem } from './missingSpriteInventory';

/** Reads saved sprites with bounded parallelism, one UI update per batch.
 * Does not generate artwork or spend AI credits. */
export async function scanSpriteReadiness(
  items: readonly Pick<SpriteInventoryItem, 'name' | 'shiny' | 'key'>[],
  readCached: (name: string, shiny: boolean) => Promise<boolean>,
  publish: (batch: Record<string, boolean>, checked: number) => void,
  cancelled: () => boolean = () => false,
  batchSize = 16,
  concurrency = 4,
): Promise<number> {
  const size = Math.max(1, Math.floor(batchSize));
  const parallel = Math.max(1, Math.floor(concurrency));
  let checked = 0;
  for (let i = 0; i < items.length && !cancelled(); i += size) {
    const batch = items.slice(i, i + size);
    const results: Record<string, boolean> = {};
    for (let j = 0; j < batch.length && !cancelled(); j += parallel) {
      const portion = batch.slice(j, j + parallel);
      const values = await Promise.all(portion.map(async item => {
        try { return await readCached(item.name, item.shiny); }
        catch { return false; }
      }));
      portion.forEach((item, index) => { results[item.key] = values[index]; });
    }
    if (cancelled()) break;
    checked += batch.length;
    publish(results, checked);
    // Yield to browser input/scroll handlers on Android between batches.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return checked;
}
