import { useRef, useState } from 'react';
import { DISCOVERY_TRAILS, trailProgress } from '../lib/discoveryTrails';
import type { InfiniteElement } from '../lib/infiniteCraftData';

export function DiscoveryTrails({ elements, busy, onPrepare }: {
  elements: InfiniteElement[]; busy: boolean; onPrepare: (a: InfiniteElement, b: InfiniteElement) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [revealed, setRevealed] = useState<string[]>([]);
  const names = elements.map(e => e.name);
  return <>
    <button className="w-full rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-sm font-semibold text-violet-400" onClick={() => dialog.current?.showModal()}>
      🧭 Discovery trails · {DISCOVERY_TRAILS.filter(t => trailProgress(t, names).completed === t.steps.length).length}/{DISCOVERY_TRAILS.length}
    </button>
    <dialog ref={dialog} aria-labelledby="trails-title" className="m-auto w-[calc(100%_-_24px)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-violet-400/30 bg-slate-950 p-5 text-slate-100 shadow-2xl backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-3">
        <h2 id="trails-title" className="text-xl font-bold">Discovery trails</h2>
        <button autoFocus onClick={() => dialog.current?.close()} className="rounded-lg border border-slate-600 px-3 py-2">Close</button>
      </div>
      <p className="my-3 text-sm text-slate-400">Follow a hint, reveal a recipe, or explore your own way. Progress follows your saved collection.</p>
      <p className="mb-4 text-xs text-amber-300">Rare bonuses: Steam, Glass and each trail finale have a 1 in 20 chance of an extra variant. You always keep the normal result. These are separate from shiny forms.</p>
      <div className="space-y-3">
        {DISCOVERY_TRAILS.map(trail => {
          const { completed, next, ready } = trailProgress(trail, names);
          const key = `${trail.id}:${next?.result}`;
          const show = revealed.includes(key);
          return <section key={trail.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h3 className="font-bold">{trail.emoji} {trail.name} <span className="float-right text-violet-300">{completed}/{trail.steps.length}</span></h3>
            <p className="my-2 text-sm text-slate-400">{trail.description}</p>
            <progress aria-label={`${trail.name} progress`} className="h-2 w-full accent-violet-400" value={completed} max={trail.steps.length} />
            {next ? <>
              <p className="mt-3 text-sm">Hint: {next.hint}</p>
              {show && <p className="mt-2 text-sm text-violet-200">{next.first} + {next.second} → ?</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-lg border border-slate-600 px-3 py-2 text-xs" onClick={() => setRevealed(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}>{show ? 'Hide recipe' : 'Reveal ingredients'}</button>
                <button disabled={!ready || busy} className="rounded-lg bg-violet-600 px-3 py-2 text-xs disabled:opacity-40" onClick={() => {
                  const a = elements.find(e => e.name.toLowerCase() === next.first.toLowerCase());
                  const b = elements.find(e => e.name.toLowerCase() === next.second.toLowerCase());
                  if (a && b) { onPrepare(a, b); dialog.current?.close(); }
                }}>Prepare combination</button>
              </div>
              {!ready && <p className="mt-2 text-xs text-slate-400">Discover the ingredients first.</p>}
            </> : <p className="mt-3 text-sm text-emerald-300">✓ Trail complete! Try your final discovery with other elements.</p>}
          </section>;
        })}
      </div>
    </dialog>
  </>;
}
