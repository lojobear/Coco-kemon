import { useEffect, useMemo, useRef, useState } from 'react';
import type { Process } from '../types';
import { parseProcedurePreferences, PROCEDURE_PREFERENCES_KEY, rememberProcedure } from '../lib/procedurePreferences';

export function BoardProcedures({ catalog, selected, busy, used, onSelect }: {
  catalog: Process[]; selected: string; busy: boolean; used: { id: string; at: number } | null;
  onSelect: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [preferences, setPreferences] = useState(() => {
    try { return parseProcedurePreferences(localStorage.getItem(PROCEDURE_PREFERENCES_KEY)); }
    catch { return parseProcedurePreferences(null); }
  });
  useEffect(() => {
    try { localStorage.setItem(PROCEDURE_PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* optional preference */ }
  }, [preferences]);
  useEffect(() => { if (used) setPreferences(previous => rememberProcedure(previous, used.id)); }, [used]);
  const byId = useMemo(() => new Map(catalog.map(process => [process.id, process])), [catalog]);
  const choose = (id: string) => { onSelect(id); dialog.current?.close(); };
  const shortcuts = (ids: string[], label: string) => {
    const choices = ids.flatMap(id => { const process = byId.get(id); return process ? [process] : []; });
    return choices.length > 0 && <div className="toybox-procedure-shortcuts" role="group" aria-label={label}>
      <strong>{label}</strong>{choices.slice(0, 6).map(process => <button type="button" key={process.id} disabled={busy}
        aria-pressed={selected === process.id} onClick={() => choose(process.id)}>{process.name}</button>)}
      {choices.length > 6 && <button type="button" disabled={busy} onClick={() => {
        setQuery(''); setCategory('all'); setFavoritesOnly(true); dialog.current?.showModal();
      }}>All favorites</button>}
    </div>;
  };
  const choices = catalog.filter(process => (!favoritesOnly || preferences.favorites.includes(process.id)) &&
    (category === 'all' || process.category === category) &&
    `${process.name} ${process.description} ${process.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="toybox-procedures" aria-label="Board procedures">
    <div><strong>Procedure</strong><span>{byId.get(selected)?.description}</span></div>
    <div className="toybox-procedure-buttons">
      {['MIX', 'MELT', 'HEAT', 'FREEZE', 'CRUSH'].map(id => byId.get(id)).filter(Boolean).map(process => <button type="button"
        key={process!.id} aria-pressed={selected === process!.id} disabled={busy} onClick={() => choose(process!.id)}>{process!.name}</button>)}
      <button type="button" disabled={busy} onClick={() => dialog.current?.showModal()}>All {catalog.length} procedures →</button>
    </div>
    {shortcuts(preferences.favorites, 'Favorites')}
    {shortcuts(preferences.recent, 'Recently used')}
    <dialog ref={dialog} className="boop-procedure-dialog" aria-labelledby="procedure-picker-title">
      <header><h2 id="procedure-picker-title">Choose a procedure</h2><button type="button" aria-label="Close procedures" onClick={() => dialog.current?.close()}>Close</button></header>
      <label>Search procedures<input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Melt, mix, freeze…" /></label>
      <div className="boop-procedure-filters"><label>Category<select value={category} onChange={event => setCategory(event.target.value)}>
        <option value="all">All categories</option>{[...new Set(catalog.map(process => process.category))].sort().map(value => <option key={value}>{value}</option>)}
      </select></label><button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}>Favorites only</button></div>
      <p role="status">{choices.length} procedures</p>
      <div className="boop-procedure-list">{choices.map(process => <div key={process.id}>
        <button type="button" disabled={busy} aria-pressed={selected === process.id} onClick={() => choose(process.id)}>
          <strong>{process.name}</strong><small>{process.category} · {process.description}</small>
        </button><button type="button" aria-label={`Favorite ${process.name}`} aria-pressed={preferences.favorites.includes(process.id)}
          onClick={() => setPreferences(previous => ({ ...previous, favorites: previous.favorites.includes(process.id)
            ? previous.favorites.filter(id => id !== process.id) : [...previous.favorites, process.id] }))}>★</button>
      </div>)}</div>
      {!choices.length && <p>No matching procedures. Try another search or category.</p>}
    </dialog>
  </section>;
}
