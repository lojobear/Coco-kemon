import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useGame } from '../lib/gameStore';
import { cloud, readCloudSave, writeCloudSave, validateCloudPayload, downloadBackup, RECOVERY_KEY, type CloudSave } from '../lib/cloudSave';

export function CloudSaves({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { exportSaveData, importSaveData, isSynthesizing } = useGame();
  const dialog = useRef<HTMLDialogElement>(null);
  const account = useRef<string | null>(null);
  const generation = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!cloud);
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<CloudSave | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [hasRecovery, setHasRecovery] = useState(false);
  // Always access the latest store callbacks after asynchronous requests.
  const game = useRef({ exportSaveData, importSaveData, isSynthesizing });
  game.current = { exportSaveData, importSaveData, isSynthesizing };

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open) dialog.current?.close();
    try { setHasRecovery(Boolean(localStorage.getItem(RECOVERY_KEY))); } catch { /* storage may be blocked */ }
  }, [open]);

  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    const accept = (next: User | null) => {
      if (!alive) return;
      if (account.current !== (next?.id ?? null)) {
        generation.current++;
        account.current = next?.id ?? null;
        setSnapshot(undefined);
        setBusy(false);
        setMessage('');
      }
      setUser(next);
      setReady(true);
    };
    const { data: { subscription } } = cloud.auth.onAuthStateChange((_event, session) => accept(session?.user ?? null));
    cloud.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) { setMessage('Sign-in could not finish. Please try Google sign-in again.'); setReady(true); }
      else accept(data.session?.user ?? null);
    }).catch(() => { if (alive) { setMessage('Could not check your account. Reload to retry.'); setReady(true); } });
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorType = searchParams.get('error') || hashParams.get('error');
    const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');
    if (errorType) {
      const decoded = errorDesc ? decodeURIComponent(errorDesc).replace(/\+/g, ' ') : '';
      if (errorType === 'access_denied' || decoded.toLowerCase().includes('access')) {
        setMessage('Access was denied by Google. If your OAuth screen is in "Testing" mode, add your email under Google Cloud Console → OAuth consent screen → Test users.');
      } else {
        setMessage(decoded ? `Sign-in error: ${decoded}` : 'Google sign-in was cancelled or could not finish. Please try again.');
      }
    }
    return () => { alive = false; generation.current++; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = generation.current;
    let alive = true;
    readCloudSave(user.id).then(saved => {
      if (alive && token === generation.current) setSnapshot(saved);
    }).catch(error => {
      if (alive && token === generation.current) setMessage(error.message);
    });
    return () => { alive = false; };
  }, [user?.id]);

  async function run(operation: (current: () => boolean) => Promise<void>) {
    if (busy) return;
    const token = generation.current;
    const current = () => token === generation.current;
    setBusy(true); setMessage('');
    try { await operation(current); }
    catch (error) { if (current()) setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { if (current()) setBusy(false); }
  }

  const button = 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed';
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose}
    aria-labelledby="cloud-title" className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-xl border border-slate-700 bg-[#181b20] p-5 text-slate-100 shadow-2xl backdrop:bg-black/70">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id="cloud-title" className="text-lg font-bold">Cloud saves</h2>
      <button className={button} onClick={onClose} aria-label="Close cloud saves">Close</button>
    </div>
    <p className="mb-4 text-sm text-slate-300">Keep both your crafting discoveries and Foundry collection with your Google account.</p>
    {!cloud ? <p className="text-sm text-amber-300">Cloud saves are coming soon. You can keep playing and export a backup from Save Management.</p> : !ready ? <p role="status">Checking your account…</p> : !user ? <>
      <button className={button} disabled={busy} onClick={() => run(async () => {
        const { error } = await cloud!.auth.signInWithOAuth({ provider: 'google', options: {
          redirectTo: window.location.origin + '/', queryParams: { prompt: 'select_account' },
        } });
        if (error) throw new Error('Google sign-in could not start. Please try again.');
      })}>Sign in with Google</button>
      <p className="mt-3 text-xs text-slate-400">Signing in leaves your current collection in place. Choose Save to cloud or Load from cloud afterward.</p>
    </> : <div className="space-y-3">
      <p className="break-all text-sm">Signed in as <strong>{user.email ?? 'Google user'}</strong></p>
      <p className="text-xs text-slate-300">{snapshot === undefined ? 'Cloud info has not loaded yet.' : snapshot === null ? 'No cloud save yet. Save this device’s collection to get started.' : `Cloud save: ${new Date(snapshot.updated_at).toLocaleString()} · revision ${snapshot.revision}`}</p>
      <p className="text-xs text-slate-400">Device saves are automatic. Cloud saves are manual: save before switching devices, then load on the other device.</p>
      <div className="grid grid-cols-2 gap-2">
        <button className={button} disabled={busy || snapshot === undefined || isSynthesizing} onClick={() => run(async current => {
          if (snapshot && !window.confirm(`Replace the cloud collection for ${user.email ?? 'this account'} with this device’s progress?`)) return;
          const saved = await writeCloudSave(game.current.exportSaveData(), snapshot?.revision ?? 0, user.id);
          if (current()) { setSnapshot(saved); setMessage('Saved to your Google account.'); }
        })}>Save to cloud</button>
        <button className={button} disabled={busy || !snapshot || isSynthesizing} onClick={() => run(async current => {
          const saved = await readCloudSave(user.id);
          if (!current()) return;
          if (!saved) { setSnapshot(null); throw new Error('No cloud save found.'); }
          const json = validateCloudPayload(saved.payload);
          if (!window.confirm('Load the cloud collection onto this device? A recovery copy of your current progress will be kept.')) return;
          if (game.current.isSynthesizing) throw new Error('Finish the current synthesis before loading.');
          try { localStorage.setItem(RECOVERY_KEY, game.current.exportSaveData()); }
          catch { throw new Error('There is not enough device storage for a recovery copy. Export a backup and free space before loading.'); }
          setHasRecovery(true);
          if (!game.current.importSaveData(json)) throw new Error('Could not load the save. Your previous collection and recovery backup are preserved.');
          setSnapshot(saved); setMessage('Cloud collection loaded on this device.');
        })}>Load from cloud</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => run(async current => {
          const saved = await readCloudSave(user.id);
          if (current()) { setSnapshot(saved); setMessage('Cloud info refreshed.'); }
        })}>Refresh cloud info</button>
        <button className={button} disabled={busy} onClick={() => run(async () => {
          const { error } = await cloud!.auth.signOut({ scope: 'local' });
          if (error) throw new Error('Could not sign out. Please retry.');
        })}>Sign out</button>
      </div>
      <p className="text-xs text-slate-400">Signing out keeps this device’s collection here. Other people using this browser can see it.</p>
    </div>}
    <p role="status" aria-live="polite" className="mt-3 text-sm text-amber-200">{busy ? 'Working…' : message}</p>
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-700 pt-3">
      <button className={button} onClick={() => downloadBackup(game.current.exportSaveData())}>Export device backup</button>
      {hasRecovery && <button className={button} onClick={() => {
        try { const json = localStorage.getItem(RECOVERY_KEY); if (json) downloadBackup(json, 'coco-kemon-before-cloud-load'); }
        catch { setMessage('Recovery storage is unavailable.'); }
      }}>Export recovery copy</button>}
    </div>
  </dialog>;
}
