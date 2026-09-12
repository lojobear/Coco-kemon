/**
 * ODDKIN FOUNDRY
 * "DISCOVER MATTER. CREATE LIFE."
 * Mobile-First AI Crafting & Procedural Genome Sprite Collection Game
 */

import React, { useState, useEffect } from 'react';
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
import { SAVE_STATUS_EVENT, getSaveError } from './lib/saveData';
import { Material } from './types';

function GameContent() {
  const { activeTab, inspectedItem, setInspectedItem, synthesisError, isSynthesizing, runSynthesis } = useGame();

  const [saveError, setSaveError] = useState(getSaveError);
  useEffect(() => {
    const update = () => setSaveError(getSaveError());
    update();
    window.addEventListener(SAVE_STATUS_EVENT, update);
    return () => window.removeEventListener(SAVE_STATUS_EVENT, update);
  }, []);
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

      {saveError && <div role="alert" className="bg-red-950 text-white p-3 text-sm">{saveError}</div>}
      {synthesisError && activeTab === 'foundry' && <div role="alert" className="bg-red-950 text-white p-3 text-sm">
        {synthesisError} <button disabled={isSynthesizing} className="underline ml-2 p-2" onClick={() => void runSynthesis()}>Retry synthesis</button>
      </div>}
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
