import { useEffect, useRef, useState } from 'react';
import { cloud } from '../lib/cloudSave';
import { useGame } from '../lib/gameStore';
import { SAVE_CHANGED_EVENT } from '../lib/saveData';
import { syncProfileSprites } from '../lib/profileSprites';
import { spriteAssets, trackSpriteSync } from '../lib/spriteAssets';

/** Artwork sync is automatic; progress cloud-save conflict handling remains manual. */
export function ProfileSpriteSync() {
  const { exportSaveData, applyProfileSpriteChanges } = useGame();
  const latest = useRef({ exportSaveData, applyProfileSpriteChanges });
  latest.current = { exportSaveData, applyProfileSpriteChanges };
  const [userId, setUserId] = useState<string>();
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    let authRevision = 0;
    const accept = (id?: string) => { spriteAssets?.clear(); setUserId(id); window.dispatchEvent(new Event('quarkpop-sprite-account')); };
    const { data } = cloud.auth.onAuthStateChange((_event, session) => { authRevision++; accept(session?.user.id); });
    const revision = authRevision;
    void cloud.auth.getSession().then(({ data }) => { if (alive && revision === authRevision) accept(data.session?.user.id); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let running = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout>;
    const sync = async () => {
      if (!alive) return;
      if (running) { dirty = true; return; }
      running = true;
      try {
        const result = await trackSpriteSync(() => syncProfileSprites(userId, latest.current.exportSaveData()));
        if (alive) latest.current.applyProfileSpriteChanges(result.changes);
      } catch { /* Visible status and retry live in Cloud saves. Local data is retained. */ }
      finally { running = false; if (dirty && alive) { dirty = false; schedule(); } }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void sync(), 1200); };
    schedule();
    window.addEventListener(SAVE_CHANGED_EVENT, schedule);
    window.addEventListener('quarkpop-sprite-ready', schedule);
    window.addEventListener('quarkpop-retry-sprites', schedule);
    window.addEventListener('online', schedule);
    return () => {
      alive = false; clearTimeout(timer);
      window.removeEventListener(SAVE_CHANGED_EVENT, schedule);
      window.removeEventListener('quarkpop-sprite-ready', schedule);
      window.removeEventListener('quarkpop-retry-sprites', schedule);
      window.removeEventListener('online', schedule);
    };
  }, [userId]);
  return null;
}
