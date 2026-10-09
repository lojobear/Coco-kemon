const memory = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

function cacheUrl(namespace: string, key: string) {
  const safe = encodeURIComponent(key).slice(0, 1500);
  return new URL(`https://quarkpop-cache.invalid/${namespace}/${safe}`);
}

function cloudflareCache(): Cache | undefined {
  try {
    return (globalThis as any).caches?.default as Cache | undefined;
  } catch {
    return undefined;
  }
}

export async function readPersistentJson<T>(namespace: string, key: string): Promise<T | undefined> {
  const memoryKey = `${namespace}:${key}`;
  if (memory.has(memoryKey)) return memory.get(memoryKey) as T;

  const cache = cloudflareCache();
  if (!cache) return undefined;

  try {
    const response = await cache.match(new Request(cacheUrl(namespace, key).toString()));
    if (!response) return undefined;
    const value = await response.json() as T;
    memory.set(memoryKey, value);
    return value;
  } catch {
    return undefined;
  }
}

export async function writePersistentJson<T>(
  namespace: string,
  key: string,
  value: T,
  maxAgeSeconds = 60 * 60 * 24 * 365
): Promise<void> {
  const memoryKey = `${namespace}:${key}`;
  memory.set(memoryKey, value);

  const cache = cloudflareCache();
  if (!cache) return;

  try {
    const response = new Response(JSON.stringify(value), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=${maxAgeSeconds}`,
      },
    });
    await cache.put(new Request(cacheUrl(namespace, key).toString()), response);
  } catch {
    // Cache failure must never block gameplay.
  }
}

export async function cachedWork<T>(
  namespace: string,
  key: string,
  work: () => Promise<T>,
  maxAgeSeconds = 60 * 60 * 24 * 365
): Promise<{ value: T; cache: 'hit' | 'miss' | 'inflight' }> {
  const existing = await readPersistentJson<T>(namespace, key);
  if (existing !== undefined) return { value: existing, cache: 'hit' };

  const pendingKey = `${namespace}:${key}`;
  const existingJob = pending.get(pendingKey) as Promise<T> | undefined;
  if (existingJob) return { value: await existingJob, cache: 'inflight' };

  const job = (async () => {
    const value = await work();
    await writePersistentJson(namespace, key, value, maxAgeSeconds);
    return value;
  })();

  pending.set(pendingKey, job);
  try {
    return { value: await job, cache: 'miss' };
  } finally {
    pending.delete(pendingKey);
  }
}
