/**
 * ODDKIN FOUNDRY
 * "DISCOVER MATTER. CREATE LIFE."
 * Mobile-First AI Crafting & Procedural Genome Sprite Collection Game
 */

import React, { useState } from 'react';
import { GameProvider, useGame } from './lib/gameStore';
import { Header } from './components/Header';
import { WorkBench } from './components/WorkBench';
import { ArchiveView } from './components/ArchiveView';
import { HabitatTerrarium } from './components/HabitatTerrarium';
import { NotebookView } from './components/NotebookView';
import { DiscoveryModal } from './components/DiscoveryModal';
import { SeedsModal } from './components/SeedsModal';
import { VoiceLabModal } from './components/VoiceLabModal';
import { BottomNav } from './components/BottomNav';
import { InfiniteCraftView } from './components/InfiniteCraftView';
import { Material } from './types';

function GameContent() {
  const { activeTab, inspectedItem, setInspectedItem } = useGame();

  const [showSeedsModal, setShowSeedsModal] = useState<boolean>(false);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);

  const handleInspectMaterial = (mat: Material) => {
    setInspectedItem({ type: 'material', item: mat });
  };

  return (
    <div className="h-screen w-full bg-[#0d0f12] text-[#f3f4f6] flex flex-col justify-between overflow-hidden selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <Header
        onOpenSeeds={() => setShowSeedsModal(true)}
        onOpenVoice={() => setShowVoiceModal(true)}
      />

      {/* Main Viewport Content */}
      <main className={`flex-1 w-full min-h-0 flex flex-col ${activeTab === 'infinite-craft' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {activeTab === 'infinite-craft' && (
          <InfiniteCraftView />
        )}

        {activeTab === 'foundry' && (
          <WorkBench onInspectMaterial={handleInspectMaterial} />
        )}

        {activeTab === 'archive' && (
          <ArchiveView
            inspectedItem={inspectedItem}
            onCloseInspect={() => setInspectedItem(null)}
          />
        )}

        {activeTab === 'habitat' && (
          <HabitatTerrarium />
        )}

        {activeTab === 'notebook' && (
          <NotebookView />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Floating Modals */}
      <DiscoveryModal />

      {showSeedsModal && (
        <SeedsModal onClose={() => setShowSeedsModal(false)} />
      )}

      {showVoiceModal && (
        <VoiceLabModal onClose={() => setShowVoiceModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}
