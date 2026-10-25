import { SpriteImage } from './SpriteImage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getElementEmoji } from '../lib/elementEmoji';
import { spriteVariantKey } from '../lib/spriteVariant';
import { generateConceptSprite, generateMaterialSprite } from '../lib/pixelRenderer';
import type { Material } from '../types';

/** Uploaded/rerolled art always wins. Generated defaults share one durable cache. */
export function ElementSprite({ name, custom, fallback, className = '', alt = '', idle = true, isShiny = false }: {
  name: string; custom?: string; fallback?: string; className?: string; alt?: string; idle?: boolean; isShiny?: boolean;
}) {
  const [art, setArt] = useState<{ key: string; url: string }>();
  const [error, setError] = useState('');
  const [temporary, setTemporary] = useState<{ key: string; url: string }>();
  const [retry, setRetry] = useState(0);
  const host = useRef<HTMLSpanElement>(null);
  const key = spriteVariantKey(name, isShiny);
  const normalKey = spriteVariantKey(name);
  useEffect(() => {
    const listener = (event: Event) => { if ((event as CustomEvent).detail === key) setRetry(n => n + 1); };
    window.addEventListener('oddkin-emoji-retry', listener);
    return () => window.removeEventListener('oddkin-emoji-retry', listener);
  }, [key]);
  useEffect(() => {
    if (custom && !isShiny) return;
    let cancelled = false;
    setError('');
    // Scrolling through an inventory should retrieve saved artwork, not queue
    // hundreds of new AI image requests just because the item is visible.
    const load = () => { void getElementEmoji(name, false, '', false, isShiny).then(async shinyUrl => {
      // Older collections have normal artwork but no separate shiny art yet.
      // Reuse it only as the base for a clearly recolored preview. Never save
      // that preview in the shiny cache or mislabel normal art as native shiny.
      const normalUrl = !shinyUrl && isShiny
        ? await getElementEmoji(name, false, '', false).catch(() => '') : '';
      if (cancelled) return;
      if (shinyUrl) setArt({ key, url: shinyUrl });
      else if (normalUrl) setArt({ key: normalKey, url: normalUrl });
      else {
        // The AI image service can exhaust its daily quota. Render an unmistakable
        // local pixel preview instead of leaving every ungenerated item as an emoji.
        // Never persist this temporary preview as finished AI art.
        try {
          const preview = generateConceptSprite(name);
          if (preview) setTemporary({ key, url: preview });
        } catch {
          // Browsers without a canvas can still display the item's emoji.
        }
      }
    }).catch(e => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : String(e));
      try {
        const preview = generateConceptSprite(name);
        if (preview) setTemporary({ key, url: preview });
      } catch {
        // Browser canvas unavailable: keep the original emoji as last resort.
      }
    }); };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    });
    if (host.current) observer.observe(host.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [key, custom, retry, isShiny, normalKey]);
  const ownShiny = isShiny && art?.key === key && Boolean(art.url);
  const url = (isShiny && ownShiny ? art?.url : undefined)
    || custom
    || (art?.key === key || (isShiny && art?.key === normalKey) ? art?.url : undefined)
    || (temporary?.key === key ? temporary.url : undefined);
  return <span ref={host} className={`element-emoji${idle ? ' sprite-idle' : ''}${isShiny ? ' boop-shiny-sprite' : ''}${ownShiny ? ' boop-shiny-authored' : ''} ${className}`} title={error ? `Sprite unavailable: ${error} Retry in Sprites.` : isShiny ? `Shiny variant of ${name}` : undefined}>
    {url ? <SpriteImage src={url} alt={alt} draggable={false} decoding="async" /> : fallback?.startsWith('data:') || fallback?.startsWith('/')
      ? <SpriteImage src={fallback} alt={alt} draggable={false} />
      : <span role={alt ? 'img' : undefined} aria-label={alt || undefined}>{fallback || '◌'}</span>}
  </span>;
}
export function MaterialSprite({ material, className, alt = '', idle = true }: { material: Material; className?: string; alt?: string; idle?: boolean }) {
  const procedural = useMemo(() => generateMaterialSprite(material), [material]);
  const custom = material.customSpriteUrl && material.customSpriteUrl !== procedural ? material.customSpriteUrl : undefined;
  return <ElementSprite name={material.displayName} custom={custom} fallback={procedural} className={className} alt={alt} idle={idle} />;
}