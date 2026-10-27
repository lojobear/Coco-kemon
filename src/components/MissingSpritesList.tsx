import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, ImageOff, Layers3, Search } from 'lucide-react';
import type { InfiniteElement } from '../lib/infiniteCraftData';
import { getElementEmoji } from '../lib/elementEmoji';
import {
  ARTWORK_QUEUE_EVENT, artworkQueueEntries, enqueueArtwork,
  type ArtworkTask,
} from '../lib/artworkQueue';
import {
  spriteInventoryItems, spriteInventoryState, type SpriteInventoryState,
} from '../lib/missingSpriteInventory';

type View = 'needs' | 'all' | 'ready';
type ScanStatus = Record<string, boolean>;

export function MissingSpritesList({
  elements,
  onSelect,
}: {
  elements: readonly InfiniteElement[];
  onSelect: (id: string) => void;
}) {
  const items = useMemo(() => spriteInventoryItems(elements), [elements]);
  const [scanned, setScanned] = useState<ScanStatus>({});
  const [checked, setChecked] = useState(0);
  const [queue, setQueue] = useState<ArtworkTask[]>(artworkQueueEntries);
  const [view, setView] = useState<View>('needs');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(35);
  const [notice, setNotice] = useState('');

  // Cache/profile-only discovery. No image API requests or credits are used.
  // Scan in short chunks so long collections never freeze the Pixel's UI.
  useEffect(() => {
    let cancelled = false;
    setChecked(0);
    setScanned({});
    const scan = async () => {
      const toCheck = items.filter(item => !item.customArt);
      const ready: ScanStatus = {};
      let progress = 0;
      for (let i = 0; i < toCheck.length && !cancelled; i += 4) {
        const chunk = toCheck.slice(i, i + 4);
        const results = await Promise.all(chunk.map(async entry => {
          try {
            return Boolean(await getElementEmoji(entry.name, false, '', false, entry.shiny));
          } catch {
            return false;
          }
        }));
        for (let j = 0; j < chunk.length; j++) ready[chunk[j].key] = results[j];
        progress += chunk.length;
        if (!cancelled) {
          setScanned({ ...ready });
          setChecked(progress);
        }
        // Yield between chunks to keep the page scroll and buttons responsive.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    };
    void scan();
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    const refresh = () => setQueue(artworkQueueEntries());
    window.addEventListener(ARTWORK_QUEUE_EVENT, refresh);
    return () => window.removeEventListener(ARTWORK_QUEUE_EVENT, refresh);
  }, []);

  useEffect(() => {
    const refreshArt = (event: Event) => {
      const key = (event as CustomEvent<string>).detail;
      const match = items.find(item => item.key === key);
      if (!match) return;
      // An event also fires when retry starts. Check cache-only so a pending
      // render is never counted as finished until its actual image is saved.
      void getElementEmoji(match.name, false, '', false, match.shiny)
        .then(sprite => {
          if (sprite) setScanned(prev => ({ ...prev, [key]: true }));
        })
        .catch(() => undefined);
    };
    window.addEventListener('oddkin-emoji-retry', refreshArt);
    return () => window.removeEventListener('oddkin-emoji-retry', refreshArt);
  }, [items]);

  const rows = useMemo(() =>
    items.map(item => ({
      item,
      status: spriteInventoryState(item, scanned[item.key], queue),
    })), [items, scanned, queue],
  );

  const totals = useMemo(() => rows.reduce((counts, entry) => {
    counts[entry.status.state]++;
    return counts;
  }, { ready: 0, queued: 0, retry: 0, missing: 0, checking: 0 } as Record<SpriteInventoryState, number>), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ item, status }) =>
      (!q || item.name.toLowerCase().includes(q)) &&
      (view === 'all' || (view === 'ready' ? status.state === 'ready' : status.state !== 'ready'))
    );
  }, [rows, search, view]);

  const queueFive = () => {
    const missing = rows.filter(({ status }) => status.state === 'missing').slice(0, 5);
    missing.forEach(({ item }) => enqueueArtwork(item.name, item.shiny));
    setNotice(missing.length
      ? `Added ${missing.length} missing ${missing.length === 1 ? 'sprite' : 'sprites'} to the artwork queue.`
      : 'No verified missing sprites to queue. Existing jobs remain scheduled.');
  };

  const unready = totals.queued + totals.retry + totals.missing + totals.checking;
  const pending = totals.queued + totals.retry;
  const scanTotal = items.filter(item => !item.customArt).length;

  return (
    <section className="boop-missing-sprites" aria-label="Missing and ungenerated sprites">
      <div className="boop-missing-heading">
        <div><h2>Missing sprites</h2><p>Every Craft discovery, including shiny variants. Preview art doesn't count as a finished AI sprite.</p></div>
        <span className="boop-missing-total">{unready} need art</span>
      </div>
      <div className="boop-missing-stats">
        <div><strong>{totals.missing}</strong><span>Need generating</span></div>
        <div><strong>{pending}</strong><span>Queued / retrying</span></div>
        <div><strong>{totals.ready}</strong><span>Saved artwork</span></div>
      </div>
      <div className="boop-missing-tools">
        <label className="boop-missing-search"><Search size={15} />
          <input value={search} onChange={e => { setSearch(e.target.value); setLimit(35); }} placeholder="Find a discovery..." aria-label="Search missing sprites" />
        </label>
        <div className="boop-missing-switch" role="group" aria-label="Artwork status filter">
          {([['needs', 'Needs art'], ['all', 'All'], ['ready', 'Ready']] as const).map(([id, label]) =>
            <button key={id} type="button" aria-pressed={view === id} onClick={() => { setView(id); setLimit(35); }}>{label}</button>)}
        </div>
      </div>
      <div className="boop-missing-actions">
        <button type="button" disabled={totals.missing === 0} onClick={queueFive}>Queue 5 missing</button>
        <small>{checked < scanTotal ? `Checking saved sprites… ${checked} / ${scanTotal}` : `${items.length} variants checked against available saved art`}</small>
      </div>
      {notice && <p className="boop-missing-message" role="status">{notice}</p>}
      <div className="boop-missing-list">
        {filtered.slice(0, limit).map(({ item, status }) =>
          <div className="boop-missing-row" key={item.key}>
            <div className="boop-missing-marker" aria-hidden="true">
              {status.state === 'ready' ? <Check size={17} /> : status.state === 'missing' ? <ImageOff size={17} /> : status.state === 'checking' ? <Layers3 size={17} /> : <Clock3 size={17} />}
            </div>
            <button type="button" className="boop-missing-name" onClick={() => onSelect(item.id)} title="Edit artwork in Sprite Lab">
              <strong>{item.name}{item.shiny ? ' ✨' : ''}</strong>
              <small>{status.label}{status.nextAttemptAt && status.nextAttemptAt > Date.now() ? ' · waiting to retry' : ''}</small>
            </button>
            {status.state === 'missing'
              ? <button type="button" className="boop-missing-queue" onClick={() => { enqueueArtwork(item.name, item.shiny); setNotice(`${item.name} added to queue.`); }}>Queue</button>
              : <span className={`boop-missing-state boop-missing-state--${status.state}`}>{status.state === 'ready' ? 'Ready' : status.state === 'checking' ? 'Check' : status.state === 'retry' ? 'Retry' : 'Queued'}</span>}
          </div>
        )}
        {!filtered.length && <div className="boop-missing-empty">{checked < scanTotal ? 'Still checking your saved artwork…' : view === 'needs' ? 'All checked Craft sprites have artwork! 🎉' : 'No matching discoveries.'}</div>}
      </div>
      {filtered.length > limit && <button type="button" className="boop-missing-more" onClick={() => setLimit(n => n + 35)}>Show 35 more · {filtered.length - limit} remaining</button>}
      <p className="boop-missing-footnote">Checking is free. Queued images generate only while Boop is open and online, subject to provider limits. Matter and Oddkin use their own artwork systems.</p>
    </section>
  );
}
