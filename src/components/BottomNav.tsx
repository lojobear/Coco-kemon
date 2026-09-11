/**
 * ODDKIN FOUNDRY - Mobile Navigation Bar
 * One-handed tactile switcher between Foundry, Archive, Habitats, and Notebook
 */

import React from 'react';
import { useGame } from '../lib/gameStore';
import { sound } from '../lib/audio';
import { Sparkles, BookOpen, Trees, FileText, Infinity as InfinityIcon, FlaskConical } from 'lucide-react';

export function BottomNav() {
  const { activeTab, setActiveTab, materials, oddkinCollection, experiments } = useGame();

  const tabs = [
    { id: 'infinite-craft', label: 'CRAFT', icon: InfinityIcon, badge: null },
    { id: 'foundry', label: 'FOUNDRY', icon: FlaskConical, badge: null },
    { id: 'archive', label: 'ARCHIVE', icon: BookOpen, badge: materials.length + oddkinCollection.length },
    { id: 'habitat', label: 'HABITAT', icon: Trees, badge: oddkinCollection.length },
    { id: 'notebook', label: 'NOTES', icon: FileText, badge: experiments.length },
  ] as const;

  return (
    <nav className="sticky bottom-0 z-30 w-full bg-[#14161c]/95 backdrop-blur-md border-t border-[#262b35] py-1 px-3 shadow-lg select-none font-mono">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                sound.playClick();
                setActiveTab(t.id);
              }}
              className={`flex-1 py-1.5 px-2 flex flex-col items-center justify-center rounded-xl transition-all relative ${
                isActive
                  ? 'text-[#f59e0b]'
                  : 'text-[#9ca3af] hover:text-[#e5e7eb]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : ''}`} />
                {t.badge !== null && t.badge > 0 && (
                  <span className="absolute -top-1 -right-2 text-[9px] font-bold px-1 rounded-full bg-[#272d3a] text-[#e5e7eb] border border-[#3e475a] leading-tight">
                    {t.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold mt-1 tracking-wider ${isActive ? 'text-[#f59e0b]' : 'text-[#6b7280]'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
