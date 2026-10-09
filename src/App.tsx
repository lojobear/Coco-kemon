/**
 * QUARKPOP
 * "DISCOVER MATTER. CREATE LIFE."
 * Mobile-First AI Crafting & Procedural Genome Sprite Collection Game
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { GameProvider, useGame } from './lib/gameStore';
import { Header } from './components/Header';
import { WorkBench } from './components/WorkBench';
import { DiscoveryModal } from './components/DiscoveryModal';
import { BottomNav } from './components/BottomNav';

const loadKitchenView = () => import('./components/KitchenView');
const loadInfiniteCraftView = () => import('./components/InfiniteCraftView');
const loadArchiveView = () => import('./components/ArchiveView');
const loadSpriteLabModal = () => import('./components/SpriteLabModal');
const loadNotebookView = () => import('./components/NotebookView');
const loadSeedsModal = () => import('./components/SeedsModal');
const loadVoiceLabModal = () => import('./components/VoiceLabModal');

const KitchenView = lazy(() => loadKitchenView().then(module => ({ default: module.KitchenView })));
const InfiniteCraftView = lazy(() => loadInfiniteCraftView().then(module => ({ default: module.InfiniteCraftView })));
const ArchiveView = lazy(() => loadArchiveView().then(module => ({ default: module.ArchiveView })));
const SpriteLabModal = lazy(() => loadSpriteLabModal().then(module => ({ default: module.SpriteLabModal })));
const NotebookView = lazy(() => loadNotebookView().then(module => ({ default: module.NotebookView })));
const SeedsModal = lazy(() => loadSeedsModal().then(module => ({ default: module.SeedsModal })));
const VoiceLabModal = lazy(() => loadVoiceLabModal().then(module => ({ default: module.VoiceLabModal })));
import { SAVE_STATUS_EVENT, getSaveError } from './lib/saveData';
import { sound } from './lib/audio';
import { Material } from './types';

function GameContent() {
  const { activeTab, setActiveTab, inspectedItem, setInspectedItem, synthesisError, isSynthesizing, runSynthesis } = useGame();

  const [kitchenOpened, setKitchenOpened] = useState(false);
  useEffect(() => { if (activeTab === 'kitchen') setKitchenOpened(true); }, [activeTab]);

  // Warm likely next screens during idle time instead of shipping every heavy view
  // in the initial Android bundle. This keeps first paint fast without making taps feel cold.
  useEffect(() => {
    const warm = () => {
      void loadKitchenView();
      void loadInfiniteCraftView();
      void loadArchiveView();
    };
    const idle = 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(warm, { timeout: 1800 })
      : window.setTimeout(warm, 1000);
    return () => {
      if ('cancelIdleCallback' in window) (window as any).cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);
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
    <div data-theme="midnight" className="h-[100dvh] max-h-[100dvh] w-full collection-app bg-white text-neutral-900 flex flex-col justify-between overflow-hidden selection:bg-neutral-900 selection:text-white">
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
        {kitchenOpened && <div hidden={activeTab !== 'kitchen'}><Suspense fallback={<div className="view-loading-card">Opening Kitchen…</div>}><KitchenView visible={activeTab === 'kitchen'} /></Suspense></div>}

        {activeTab === 'infinite-craft' && (
          <Suspense fallback={<div className="view-loading-card">Warming the Craft lab…</div>}><InfiniteCraftView /></Suspense>
        )}

        {activeTab === 'foundry' && (
          <WorkBench onInspectMaterial={handleInspectMaterial} />
        )}

        {activeTab === 'archive' && (
          <Suspense fallback={<div className="view-loading-card">Opening your collection…</div>}>
            <ArchiveView
              inspectedItem={inspectedItem}
              onCloseInspect={() => setInspectedItem(null)}
            />
          </Suspense>
        )}

        {activeTab === 'sprite-lab' && (
          <Suspense fallback={<div className="view-loading-card">Opening Sprite Lab…</div>}><SpriteLabModal embedded /></Suspense>
        )}

        {activeTab === 'notebook' && (
          <Suspense fallback={<div className="view-loading-card">Opening notebook…</div>}><NotebookView /></Suspense>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Floating Modals */}
      <DiscoveryModal />

      {showSeedsModal && (
        <Suspense fallback={null}><SeedsModal onClose={() => setShowSeedsModal(false)} /></Suspense>
      )}

      {showVoiceModal && (
        <Suspense fallback={null}><VoiceLabModal onClose={() => setShowVoiceModal(false)} /></Suspense>
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

