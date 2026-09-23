import { useGame } from '../lib/gameStore';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import { FlaskConical, Hammer, LayoutGrid, Cat } from 'lucide-react';

export function BottomNav() {
  const { activeTab, setActiveTab } = useGame();
  const tabs = [
    { id: 'foundry', label: 'Foundry', icon: FlaskConical },
    { id: 'infinite-craft', label: 'Craft', icon: Hammer },
    { id: 'archive', label: 'Collection', icon: LayoutGrid },
    { id: 'sprite-lab', label: 'Sprites', icon: Cat },
  ] as const;
  return <nav className="collection-nav" aria-label="Main navigation"><div>
    {tabs.map(t => <button key={t.id} aria-current={activeTab === t.id ? 'page' : undefined} onClick={() => { sound.playClick(); haptics.lightTap(); setActiveTab(t.id); }}><t.icon size={25} /><span>{t.label}</span></button>)}
  </div></nav>;
}
