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
import { NotebookView } from './components/NotebookView';
import { DiscoveryModal } from './components/DiscoveryModal';
import { SeedsModal } from './components/SeedsModal';
import { VoiceLabModal } from './components/VoiceLabModal';
import { SpriteLabModal } from './components/SpriteLabModal';
import { BottomNav } from './components/BottomNav';
import { InfiniteCraftView } from './components/InfiniteCraftView';
import { SAVE_STATUS_EVENT, getSaveError } from './lib/saveData';
import { sound } from './lib/audio';
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

  // Pre-warm Web Audio context on first user touch / pointer event for Android Chrome
  useEffect(() => {
    const handleFirstTouch = () => {
      sound.unlock();
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('pointerdown', handleFirstTouch);
    };
    window.addEventListener('touchstart', handleFirstTouch, { once: true, passive: true });
    window.addEventListener('pointerdown', handleFirstTouch, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('pointerdown', handleFirstTouch);
    };
  }, []);

  const [showSeedsModal, setShowSeedsModal] = useState<boolean>(false);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);

  const handleInspectMaterial = (mat: Material) => {
    setInspectedItem({ type: 'material', item: mat });
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full collection-app bg-white text-neutral-900 flex flex-col justify-between overflow-hidden selection:bg-neutral-900 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenSeeds={() => setShowSeedsModal(true)}
        onOpenVoice={() => setShowVoiceModal(true)}
      />

      {saveError && <div role="alert" className="bg-red-50 text-red-900 border-b border-red-200 p-3 text-sm">{saveError}</div>}
      {synthesisError && activeTab === 'foundry' && <div role="alert" className="bg-red-50 text-red-900 border-b border-red-200 p-3 text-sm">
        {synthesisError} <button disabled={isSynthesizing} className="underline ml-2 p-2" onClick={() => void runSynthesis()}>Retry synthesis</button>
      </div>}
      {/* Main Viewport Content */}
      <main className={`flex-1 w-full min-h-0 flex flex-col ${(activeTab === 'infinite-craft' || activeTab === 'sprite-lab' || activeTab === 'foundry') ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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

        {activeTab === 'sprite-lab' && (
          <SpriteLabModal embedded />
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
