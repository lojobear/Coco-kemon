import { memo, startTransition, useCallback, useEffect, useState } from 'react';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import { FlaskConical, LayoutGrid, Cat, ChefHat, Cloud, UserRound } from 'lucide-react';

export type BottomTab = 'foundry' | 'kitchen' | 'infinite-craft' | 'archive' | 'sprite-lab' | 'profile';

const TABS = [
  { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
  { id: 'infinite-craft', label: 'Craft', icon: FlaskConical },
  { id: 'archive', label: 'Collection', icon: LayoutGrid },
  { id: 'sprite-lab', label: 'Sprites', icon: Cat },
  { id: 'profile', label: 'Profile', icon: UserRound },
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
  useEffect(() => {
    setVisualTab(activeTab);
  }, [activeTab]);

  const selectTab = useCallback((tab: BottomTab) => {
    if (tab === activeTab) return;

    // Give immediate audible and tactile feedback on the original tap.
    // Deferring navigation to requestAnimationFrame made the app feel sluggish.
    // The destination still mounts at transition priority so touch feedback paints.
    haptics.lightTap();
    sound.playClick();
    setVisualTab(tab);
    startTransition(() => setActiveTab(tab));
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
