import { ProfileSpriteSync } from './components/ProfileSpriteSync';
/**
 * BOOP
 * "DISCOVER MATTER. CREATE LIFE."
 * Mobile-First AI Crafting & Procedural Genome Sprite Collection Game
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { GameProvider, useGame } from './lib/gameStore';
import { CloudSaves } from './components/CloudSaves';
import { Header } from './components/Header';
import { DiscoveryModal } from './components/DiscoveryModal';
import { BottomNav } from './components/BottomNav';

const loadWorkBench = () => import('./components/WorkBench');
const WorkBench = lazy(() => loadWorkBench().then(module => ({ default: module.WorkBench })));
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
import { isAndroidNativeShell, isNativeTab, sendToAndroid } from './lib/nativeShell';

function GameContent() {
  const { activeTab, setActiveTab, inspectedItem, setInspectedItem } = useGame();
  const nativeShell = isAndroidNativeShell();

  const [showCloud, setShowCloud] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');
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
    // Keep a timeout fallback without narrowing the Window type to never.
    const idleApi = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof idleApi.requestIdleCallback === 'function' && typeof idleApi.cancelIdleCallback === 'function') {
      const idle = idleApi.requestIdleCallback(warm, { timeout: 1800 });
      return () => idleApi.cancelIdleCallback?.(idle);
    }
    const timeout = globalThis.setTimeout(warm, 1000);
    return () => globalThis.clearTimeout(timeout);
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

  // Android owns the visible toolbar and navigation while the app continues
  // to render the *same live* Cloudflare-backed game and sprite components.
  useEffect(() => {
    if (!nativeShell) return;
    const navigate = (event: Event) => {
      const requested = (event as CustomEvent<string>).detail;
      if (typeof requested === 'string' && isNativeTab(requested)) setActiveTab(requested);
    };
    const openCloud = () => setShowCloud(true);
    const handleBack = () => {
      if (showCloud) setShowCloud(false);
      else if (showSeedsModal) setShowSeedsModal(false);
      else if (showVoiceModal) setShowVoiceModal(false);
      else if (inspectedItem) setInspectedItem(null);
    };
    window.addEventListener('boop-native-tab', navigate);
    window.addEventListener('boop-native-profile', openCloud);
    window.addEventListener('boop-native-back', handleBack);
    return () => {
      window.removeEventListener('boop-native-tab', navigate);
      window.removeEventListener('boop-native-profile', openCloud);
      window.removeEventListener('boop-native-back', handleBack);
    };
  }, [nativeShell, setActiveTab, showCloud, showSeedsModal, showVoiceModal, inspectedItem, setInspectedItem]);

  useEffect(() => {
    if (nativeShell) sendToAndroid({ type: 'tab', tab: activeTab === 'seeds' ? 'foundry' : activeTab });
  }, [nativeShell, activeTab]);

  return (
    <div data-theme="quark-light" className="boop-app h-[100dvh] max-h-[100dvh] w-full collection-app bg-white text-neutral-900 flex flex-col justify-between overflow-hidden selection:bg-neutral-900 selection:text-white">
      {/* Top Header */}
      {!nativeShell && <Header
        onOpenProfile={() => setShowCloud(true)}
        onSearchCollection={query => { setCollectionSearch(query); setActiveTab('archive'); }}
        onOpenSeeds={() => setShowSeedsModal(true)}
        onOpenVoice={() => setShowVoiceModal(true)}
      />}

      {/* Main Viewport Content */}
      <main className={`boop-main flex-1 w-full min-h-0 flex flex-col ${(activeTab === 'infinite-craft') ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {saveError && <div role="alert" className="boop-save-alert">{saveError}</div>}
        {kitchenOpened && <div hidden={activeTab !== 'kitchen'}><Suspense fallback={<div className="view-loading-card">Opening Kitchen…</div>}><KitchenView visible={activeTab === 'kitchen'} /></Suspense></div>}

        {activeTab === 'foundry' && <Suspense fallback={<div className="view-loading-card">Opening Foundry…</div>}><WorkBench onInspectMaterial={item => setInspectedItem({ type: 'material', item })} /></Suspense>}

        {activeTab === 'infinite-craft' && (
          <Suspense fallback={<div className="view-loading-card">Warming the Craft lab…</div>}><InfiniteCraftView /></Suspense>
        )}

        {activeTab === 'archive' && (
          <Suspense fallback={<div className="view-loading-card">Opening your collection…</div>}>
            <ArchiveView
              initialSearch={collectionSearch}
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
      {!nativeShell && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onOpenProfile={() => setShowCloud(true)} />
      <CloudSaves open={showCloud} onClose={() => setShowCloud(false)} />

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
      <ProfileSpriteSync />
      <GameContent />
    </GameProvider>
  );
}

