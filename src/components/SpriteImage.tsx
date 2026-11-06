import React, { useEffect, useState } from 'react';
import { resolveSpriteSource } from '../lib/spriteAssets';
import { isSpriteReference } from '../lib/spriteReference';

/** Resolve private files at display time; account credentials never enter image URLs. */
export function SpriteImage({ src, onError, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [resolved, setResolved] = useState<{ source?: string; url?: string; error?: string }>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setFailedUrl(undefined);
    if (!isSpriteReference(src)) return;
    let alive = true;
    setResolved(undefined);
    void resolveSpriteSource(src).then(url => { if (alive) setResolved({ source: src, url }); })
      .catch(error => { if (alive) setResolved({ source: src, error: error.message }); });
    return () => { alive = false; };
  }, [src, retry]);
  const hasFailed = Boolean(failedUrl) || Boolean(isSpriteReference(src) && resolved?.source === src && resolved.error);
  const retryFailed = () => {
    setFailedUrl(undefined);
    setRetry(n => n + 1);
  };
  // Healthy thumbnails should not attach four global listeners apiece.
  // Failed ones can recover on reconnect, profile change or manual retry.
  useEffect(() => {
    if (!hasFailed) return;
    const onVisible = () => { if (document.visibilityState === 'visible') retryFailed(); };
    window.addEventListener('quarkpop-retry-sprites', retryFailed);
    window.addEventListener('quarkpop-sprite-account', retryFailed);
    window.addEventListener('online', retryFailed);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('quarkpop-retry-sprites', retryFailed);
      window.removeEventListener('quarkpop-sprite-account', retryFailed);
      window.removeEventListener('online', retryFailed);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasFailed]);
  const url = isSpriteReference(src) ? (resolved?.source === src ? resolved.url : undefined) : src;
  const unavailable = Boolean(resolved?.source === src && resolved?.error) || Boolean(url && failedUrl === url) || !src;
  if (!url || failedUrl === url) return <span role="img" aria-label={`${props.alt || 'Sprite'}: ${unavailable ? 'artwork unavailable, retry in Sprites' : 'artwork loading'}`}
    className={`boop-sprite-placeholder ${props.className || ''}`} title={unavailable ? 'Artwork unavailable. Retry in Sprites.' : 'Loading artwork'}>
    <span className="boop-placeholder-shape" aria-hidden="true" />
    <span className="boop-placeholder-cue" aria-hidden="true">{unavailable ? '!' : '…'}</span>
    {src && unavailable && <button type="button" className="boop-sprite-retry"
      aria-label={`Retry loading ${props.alt || 'sprite'} artwork`} onClick={retryFailed}>Retry</button>}
  </span>;
  return <img {...props} src={url} onError={event => { setFailedUrl(url); onError?.(event); }} />;
}
