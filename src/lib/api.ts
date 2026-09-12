/** Bounded JSON requests: failures never masquerade as discoveries. */
export async function requestJson<T>(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${response.status}). Please retry.`);
    if (!data || typeof data !== 'object') throw new Error('The server returned an invalid result. Please retry.');
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The request timed out or was cancelled. Please retry.');
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}
