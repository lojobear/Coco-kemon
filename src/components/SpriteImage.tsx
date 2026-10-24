import React, { useEffect, useState } from 'react';
import { resolveSpriteSource } from '../lib/spriteAssets';
import { isSpriteReference } from '../lib/spriteReference';

/** Resolve private files at display time; account credentials never enter image URLs. */
export function SpriteImage({ src, fallbackSrc, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fallbackSrc?: string }) {
  const [resolved, setResolved] = useState<{ source?: string; url?: string; error?: string }>();
  const [retry, setRetry] = useState(0);
  const [brokenSource, setBrokenSource] = useState<string | undefined>();
  useEffect(() => {
    if (!isSpriteReference(src)) return;
    let alive = true;
    setResolved(undefined);
    void resolveSpriteSource(src).then(url => { if (alive) setResolved({ source: src, url }); })
      .catch(error => { if (alive) setResolved({ source: src, error: error.message }); });
    const retryLoad = () => setRetry(n => n + 1);
    window.addEventListener('quarkpop-retry-sprites', retryLoad);
    window.addEventListener('quarkpop-sprite-account', retryLoad);
    return () => { alive = false; window.removeEventListener('quarkpop-retry-sprites', retryLoad); window.removeEventListener('quarkpop-sprite-account', retryLoad); };
  }, [src, retry]);
  const candidate = isSpriteReference(src) ? (resolved?.source === src ? resolved.url : undefined) : src;
  // A saved remote sprite can be missing/offline; never show placeholder glyphs.
  // The offline original pixel-art sprite remains visible while files resolve.
  const url = candidate && candidate !== brokenSource ? candidate : fallbackSrc;
  if (!url) return null;
  return <img {...props} src={url} onError={event => {
    if (candidate && candidate !== fallbackSrc) setBrokenSource(candidate);
    props.onError?.(event);
  }} />;
}
