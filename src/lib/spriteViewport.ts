/**
 * One shared viewport observer for the whole sprite collection.
 * Per-card IntersectionObservers are expensive on Android WebView when a
 * collector owns hundreds of sprites. A zero-cost eager fallback is used
 * in browsers that do not implement IntersectionObserver.
 */
type OnVisible = () => void;
const pending = new Map<Element, OnVisible>();
let observer: IntersectionObserver | undefined;

export function observeSpriteViewport(element: Element, onVisible: OnVisible): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onVisible();
    return () => undefined;
  }
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const notify = pending.get(entry.target);
        if (!notify) continue;
        pending.delete(entry.target);
        observer?.unobserve(entry.target);
        notify();
      }
    }, { rootMargin: '240px 0px' });
  }
  pending.set(element, onVisible);
  observer.observe(element);
  return () => {
    pending.delete(element);
    observer?.unobserve(element);
  };
}
