import { memo, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import { FlaskConical, LayoutGrid, Cat, ChefHat, Cloud } from 'lucide-react';

export type BottomTab = 'foundry' | 'kitchen' | 'infinite-craft' | 'archive' | 'sprite-lab';

const TABS = [
  { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
  { id: 'infinite-craft', label: 'Craft', icon: FlaskConical },
  { id: 'archive', label: 'Collection', icon: LayoutGrid },
  { id: 'sprite-lab', label: 'Sprites', icon: Cat },
] as const;

function BottomNavInner({
  activeTab,
  setActiveTab,
  onOpenProfile,
}: {
  activeTab: BottomTab | 'notebook' | 'seeds';
  setActiveTab: (tab: BottomTab) => void;
  onOpenProfile: () => void;
}) {
  const [visualTab, setVisualTab] = useState(activeTab);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    setVisualTab(activeTab);
  }, [activeTab]);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const selectTab = useCallback((tab: BottomTab) => {
    if (tab === activeTab) return;

    // Paint the active state first so taps always feel instant, then mount the
    // heavier destination view on the next frame at transition priority.
    setVisualTab(tab);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      startTransition(() => setActiveTab(tab));
      frame.current = null;
      queueMicrotask(() => {
        sound.playClick();
        haptics.lightTap();
      });
    });
  }, [activeTab, setActiveTab]);

  return (
    <nav className="collection-nav boop-navigation" aria-label="Main navigation">
      <p className="boop-nav-label">YOUR STUDIO</p>
      <div className="boop-nav-items">
        {TABS.map(tab => {
          const current = visualTab === tab.id || (visualTab === 'foundry' && tab.id === 'infinite-craft');
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => selectTab(tab.id)}
            >
              <tab.icon size={25} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className="boop-profile-card"><Cloud size={22} /><strong>Your collection, kept.</strong><p>Back up your discoveries and artwork to your profile.</p><button onClick={onOpenProfile}>Your profile</button></div>
    </nav>
  );
}

export const BottomNav = memo(BottomNavInner);
