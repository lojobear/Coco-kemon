/** Bounded JSON requests: failures never masquerade as discoveries. */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000,
  opts: { retries?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const maxRetries = Math.max(0, Math.min(2, opts.retries ?? 0));
  const baseDelayMs = Math.max(0, opts.retryDelayMs ?? 800);
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestJsonAttempt<T>(url, init, timeoutMs);
    } catch (error) {
      if (attempt >= maxRetries || !isTransientFailure(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }
}

/**
 * Only failures worth retrying: our own client-side timeouts and HTTP 408/5xx.
 * Quota (429), auth (401/403) and validation (4xx) errors are terminal — retrying
 * them just burns quota or hammers the server.
 */
function isTransientFailure(error: unknown): boolean {
  const err = error as { timedOut?: boolean; status?: number } | null;
  if (err?.timedOut) return true;
  const status = err?.status;
  return status === 408 || (typeof status === 'number' && status >= 500 && status < 600);
}

async function requestJsonAttempt<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = new Error(typeof data?.error === 'string' ? data.error : `Request failed (${response.status}). Please retry.`);
      (failure as { status?: number }).status = response.status;
      throw failure;
    }
    if (!data || typeof data !== 'object') throw new Error('The server returned an invalid result. Please retry.');
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) {
      const failure = new Error('The request timed out or was cancelled. Please retry.');
      // Only our own timeout is retryable; a caller-initiated cancel is not.
      (failure as { timedOut?: boolean }).timedOut = timedOut;
      throw failure;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}
