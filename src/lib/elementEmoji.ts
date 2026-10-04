import { emojiKey } from './emojiGeometry';
import { requestJson } from './api';

const memory = new Map<string, string>();
const jobs = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('oddkin-element-emoji', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('art');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Emoji storage is unavailable.'));
  });
}
async function stored(key: string): Promise<string | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const r = database.transaction('art').objectStore('art').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read saved emoji.'));
  });
}
async function save(key: string, data: string) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('art', 'readwrite');
    tx.objectStore('art').put(data, key);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(new Error('Could not save emoji. Free some browser storage.'));
  });
}
export function getElementEmoji(name: string): Promise<string> {
  const key = emojiKey(name);
  if (memory.has(key)) return Promise.resolve(memory.get(key)!);
  if (jobs.has(key)) return jobs.get(key)!;
  const work = async () => {
    // Check durable storage inside the lock; another tab may have already drawn it.
    const cached = await stored(key);
    if (cached) { memory.set(key, cached); return cached; }
    const { svg } = await requestJson<{ svg: string }>('/api/element-emoji', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: key }),
    });
    if (typeof svg !== 'string' || !svg.startsWith('<svg ') || svg.length > 120000) throw new Error('Invalid emoji response.');
    const data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    // Keep the generated result even if disk storage fails; never re-bill on rerender.
    memory.set(key, data);
    await save(key, data);
    return data;
  };
  const job = queue.then(() => navigator.locks
    ? navigator.locks.request(`oddkin-emoji:${key}`, work)
    : work());
  queue = job.catch(() => undefined);
  // Failed jobs also stay here until explicit retry, avoiding paid retry loops.
  jobs.set(key, job);
  return job;
}
export function retryElementEmoji(name: string) {
  jobs.delete(emojiKey(name));
  window.dispatchEvent(new CustomEvent('oddkin-emoji-retry', { detail: emojiKey(name) }));
}
