import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getElementEmoji } from '../lib/elementEmoji';
import { emojiKey } from '../lib/emojiGeometry';
import { generateMaterialSprite } from '../lib/pixelRenderer';
import type { Material } from '../types';

/** Uploaded/rerolled art always wins. Generated defaults share one durable cache. */
export function ElementSprite({ name, custom, fallback, className = '', alt = '' }: {
  name: string; custom?: string; fallback?: string; className?: string; alt?: string;
}) {
  const [art, setArt] = useState<{ key: string; url: string }>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const host = useRef<HTMLSpanElement>(null);
  const key = emojiKey(name);
  useEffect(() => {
    const listener = (event: Event) => { if ((event as CustomEvent).detail === key) setRetry(n => n + 1); };
    window.addEventListener('oddkin-emoji-retry', listener);
    return () => window.removeEventListener('oddkin-emoji-retry', listener);
  }, [key]);
  useEffect(() => {
    if (custom) return;
    let cancelled = false;
    setError('');
    const load = () => { void getElementEmoji(name).then(url => {
      if (!cancelled) setArt({ key, url });
    }).catch(e => { if (!cancelled) setError(e.message); }); };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    });
    if (host.current) observer.observe(host.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [key, custom, retry]);
  const url = custom || (art?.key === key ? art.url : undefined);
  return <span ref={host} className={`element-emoji ${className}`} title={error ? `Emoji unavailable: ${error} Retry in Sprites.` : undefined}>
    {url ? <img src={url} alt={alt} draggable={false} decoding="async" /> : fallback?.startsWith('data:') || fallback?.startsWith('/')
      ? <img src={fallback} alt={alt} draggable={false} />
      : <span role={alt ? 'img' : undefined} aria-label={alt || undefined}>{fallback || '◌'}</span>}
  </span>;
}
export function MaterialSprite({ material, className, alt = '' }: { material: Material; className?: string; alt?: string }) {
  const procedural = useMemo(() => generateMaterialSprite(material), [material]);
  const custom = material.customSpriteUrl && material.customSpriteUrl !== procedural ? material.customSpriteUrl : undefined;
  return <ElementSprite name={material.displayName} custom={custom} fallback={procedural} className={className} alt={alt} />;
}
