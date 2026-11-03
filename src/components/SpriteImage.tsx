import React, { useEffect, useState } from 'react';
import { resolveSpriteSource } from '../lib/spriteAssets';
import { isSpriteReference } from '../lib/spriteReference';

/** Resolve private files at display time; account credentials never enter image URLs. */
export function SpriteImage({ src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [resolved, setResolved] = useState<{ source?: string; url?: string; error?: string }>();
  const [retry, setRetry] = useState(0);
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
  const url = isSpriteReference(src) ? (resolved?.source === src ? resolved.url : undefined) : src;
  if (!url) return <span role="img" aria-label={props.alt || 'Sprite loading'} className={props.className} title={resolved?.error}>◌</span>;
  return <img {...props} src={url} />;
}
