import { displayConceptName } from '../lib/conceptMeaning';
import { ElementValueBadge } from './ElementValue';
import { buildCollectionValueBook } from '../lib/elementValue';
import { useGame } from '../lib/gameStore';
import { BoardProcedures } from './BoardProcedures';
import { tidyBoard } from '../lib/tidyBoard';
import { conceptMaterial } from '../lib/conceptMaterial';
import { availableProcesses } from '../lib/availableProcesses';
import { DiscoveryCard } from './DiscoveryCard';
import { PROFILE_SPRITES_UPDATED } from '../lib/profileSprites';
import { CraftSprite, CraftSprites } from './CraftSprite';
import { DiscoveryTrails } from './DiscoveryTrails';
/**
 * INFINITE CRAFT (by Neal Agarwal) - High-Tactile Interactive Web View
 * Freeform canvas, draggable element pills, search sidebar, instant canonical pairings,
 * AI generation, persistent collection statistics, shiny variants, and recipe history.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  STARTER_ELEMENTS,
  InfiniteElement,
} from '../lib/infiniteCraftData';
import { resolveSharedPair, rollSharedPair, applySharedPairDiscovery } from '../lib/sharedCraftingEngine';
import { enqueueArtwork } from '../lib/artworkQueue';
import { beginBoardHistory, recordBoardHistory, undoBoard, redoBoard, clampBoardZoom } from '../lib/boardHistory';
import { BUILT_IN_PAIR_RECIPES } from '../lib/builtInPairs';
import { findCraftDropTarget } from '../lib/craftCollision';
import { BOARD_WIDTH, BOARD_HEIGHT, BOARD_START_X, BOARD_START_Y, clampBoardTile } from '../lib/boardGeometry';
import { loadBoardLayout, saveBoardLayout } from '../lib/boardLayout';
import { chooseSpawnElements, chooseUndiscoveredPair, spawnPositions, spreadSpawnPositions, SPAWN_COUNTS, type SpawnCount, type SpawnSource, type SpawnViewport } from '../lib/randomSpawn';
import { smartSpawnPool, smartSpawnCategories, chooseUntriedPair, type SmartRarity } from '../lib/smartRandomizer';
import { buildCollectionCategoryIndex } from '../lib/collectionCategories';
import { planAdvancedFusion, applyAdvancedFusion, type FusionPlan } from '../lib/advancedFusion';
import { AdvancedFusionModal } from './AdvancedFusionModal';
import { queueCraftElementsSave, flushQueuedCraftSave, readCraftElements, SAVE_IMPORTED_EVENT, SAVE_CHANGED_EVENT } from '../lib/saveData';
import { discoveryIdentity } from '../lib/unifiedCollection';
import { isProceduralDefault } from './ElementSprite';
import { mergeSharedDiscoveries } from '../lib/sharedDiscoveries';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import type { ActiveCombination } from './CombineAnimationOverlay';
import { CraftingCrucible, CrucibleSlotItem } from './CraftingCrucible';
import { ElementDossierModal } from './ElementDossierModal';
import { generateConceptSprite } from '../lib/pixelRenderer';
import { generatePhysicalData, getShinyFoilStyle } from '../lib/physicalDataEngine';
import { rollOddsCaption, rarityInfo } from '../lib/rarity';
import { RarityBadges } from './RarityBadges';
import {
  normalizeElementStats,
  getElementMastery,
  getCollectionStats,
} from '../lib/elementStats';
import {
  Search,
  Trash2,
  Sparkles,
  Sun,
  Moon,
  Clock,
  ArrowDownAZ,
  X,
  Plus,
  Volume2,
  VolumeX,
  Info,
  LayoutGrid,
  ChevronLeft,
  Check,
  Zap,
  Shuffle,
  Undo2,
  Redo2,
  Minus,
  ZoomIn,
  CheckCircle2,
  Trophy,
  SlidersHorizontal,
} from 'lucide-react';

interface CanvasItem {
  instanceId: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  isNew?: boolean;
  isShiny?: boolean;
  spawnDelay?: number;
}

/** Only the moved/selected board tile should rerender. The other 299 tiles
 * keep their existing PNG decoders and DOM even when a discovery finishes. */
const CanvasBoardTile = React.memo(function CanvasBoardTile({
  item, selected, onPointerDown, onClickItem, onDuplicate, onRemove, spawnTileMaxWidth, label, category,
}: {
  item: CanvasItem;
  label?: string;
  category?: string;
  spawnTileMaxWidth: number;
  selected: boolean;
  onPointerDown: (item: CanvasItem, event: React.PointerEvent<HTMLDivElement>) => void;
  onClickItem: (item: CanvasItem) => void;
  onDuplicate: (item: CanvasItem, event: React.MouseEvent) => void;
  onRemove: (id: string, event: React.MouseEvent) => void;
}) {
  return <div data-craft-instance={item.instanceId}
    className={`boop-board-item ${selected ? 'is-selected' : ''} ${item.instanceId.startsWith('fusion-') ? 'is-fusion-result' : ''} ${item.instanceId.startsWith('spawn-') ? 'is-random-spawn' : ''}`}
    onPointerDown={event => onPointerDown(item, event)}
    onDoubleClick={event => onDuplicate(item, event)}
    style={{ transform: `translate3d(${item.x}px,${item.y}px,0)`, '--spawn-delay': `${item.spawnDelay || 0}ms`, maxWidth: `${spawnTileMaxWidth}px` } as React.CSSProperties}>
    <button type="button" className="boop-tile-select" aria-label={`Select ${label || item.name} to combine`}
      aria-pressed={selected} onClick={event => { event.stopPropagation(); onClickItem(item); }}>
      <CraftSprite name={item.name} emoji={item.emoji} category={category} isShiny={item.isShiny} />
      <span title={label || item.name}>{label || item.name}</span>
    </button>
    {selected && <CheckCircle2 className="toybox-piece-check" size={28} aria-hidden="true" />}
    <button aria-label={`Duplicate ${item.name}`} title="Duplicate" className="boop-tile-action boop-tile-duplicate" onClick={event => onDuplicate(item, event)}><Plus size={12} /></button>
    <button aria-label={`Remove ${item.name} from board`} title="Remove" className="boop-tile-action" onClick={event => onRemove(item.instanceId, event)}><X size={12} /></button>
  </div>;
});

/**
 * Stable card props keep the ingredient gallery from rerendering on random taps.
 * With hundreds of discovered items this is the biggest perceived latency win.
 */
const IngredientLibraryCard = React.memo(function IngredientLibraryCard({
  item, selected, disabled, onPick, onInspect,
}: {
  item: InfiniteElement;
  selected: boolean;
  disabled: boolean;
  onPick: (item: InfiniteElement) => void;
  onInspect: (item: InfiniteElement) => void;
}) {
  return <DiscoveryCard
    name={item.name}
    emoji={item.emoji}
    detail={item.isShiny ? 'Shiny' : item.isNew ? 'First discovery' : `${item.craftCount || 0} crafts`}
    isShiny={item.isShiny}
    item={item}
    selected={selected}
    disabled={disabled}
    onSelect={() => onPick(item)}
    onInspect={() => onInspect(item)}
  />;
});

/** Deduplicate, normalize and backfill collection statistics for old saves. */
export function sanitizeElements(list: InfiniteElement[]): InfiniteElement[] {
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const result: InfiniteElement[] = [];

  for (const item of list) {
    if (!item || !item.name) continue;
    const cleanName = item.name.trim();
    const normName = discoveryIdentity(cleanName);
    const cleanId = (item.id || normName.replace(/[^a-z0-9]/g, '_')).toLowerCase();

    if (!seenNames.has(normName) && !seenIds.has(cleanId)) {
      seenNames.add(normName);
      seenIds.add(cleanId);
      result.push(normalizeElementStats({
        ...item,
        id: cleanId,
        name: cleanName,
        emoji: item.emoji || '✨',
      }));
    }
  }

  for (const starter of STARTER_ELEMENTS) {
    const starterNorm = discoveryIdentity(starter.name);
    const starterCleanId = starter.id.toLowerCase();
    if (!seenNames.has(starterNorm) && !seenIds.has(starterCleanId)) {
      seenNames.add(starterNorm);
      seenIds.add(starterCleanId);
      result.push(normalizeElementStats({ ...starter, id: starterCleanId }));
    }
  }

  return result;
}

export function InfiniteCraftView() {
  const { setActiveTab, materials: foundryMaterials, oddkinCollection: foundryOddkin,
    processes, runSynthesis, isSynthesizing: foundryBusy } = useGame();
  const [procedureId, setProcedureId] = useState('MIX');
  const [usedProcedure, setUsedProcedure] = useState<{ id: string; at: number } | null>(null);
  const procedureRequest = useRef(false);
  const showFreeform = true;
  const procedureCatalog = useMemo(() => availableProcesses(processes), [processes]);
  const [ingredientFilter, setIngredientFilter] = useState<'all' | 'new' | 'shiny'>('all');
  const [lastResult, setLastResult] = useState<InfiniteElement | null>(null);
  const [elements, setElements] = useState<InfiniteElement[]>(() => {
    try {
      const saved = readCraftElements();
      if (saved.length > 0) return sanitizeElements(saved);
    } catch {
      // Fall back to starters.
    }
    return sanitizeElements(STARTER_ELEMENTS);
  });

  useEffect(() => {
    const reload = () => {
      requestRef.current?.abort();
      setElements(sanitizeElements(readCraftElements()));
      // Restore saved board positions from the cloud/imported backup.
      // An old-format backup without a board layout safely starts blank.
      setCanvasItems(loadBoardLayout(readCraftElements()) ?? []);
      setLastResult(null);
      setCrucibleSlotA(null);
      setCrucibleSlotB(null);
      setSelectedCanvasId(null);
      setSecondSelectedCanvasId(null);
      setCombineError(null);
      lastPairRef.current = null;
    };
    window.addEventListener(SAVE_IMPORTED_EVENT, reload);
    return () => window.removeEventListener(SAVE_IMPORTED_EVENT, reload);
  }, []);

  // Foundry saves can introduce discoveries while Craft is mounted. Add only
  // genuinely new names, never clobber local Craft mastery, rare variants or
  // in-progress combination state.
  useEffect(() => {
    const update = () => {
      const persisted = readCraftElements();
      setElements(current => {
        const previousByName = new Map(current.map(item => [discoveryIdentity(item.name), item]));
        const savedByName = new Map(persisted.map(item => [discoveryIdentity(item.name), item]));
        let updatedArtwork = false;
        // Keep Sprite Lab uploads/recoveries from being overwritten by a
        // delayed Craft save while the (hidden) Craft board stays mounted.
        const updated = current.map(item => {
          const saved = savedByName.get(discoveryIdentity(item.name));
          if (!saved || saved.customSpriteUrl === item.customSpriteUrl) return item;
          updatedArtwork = true;
          return { ...item, customSpriteUrl: saved.customSpriteUrl };
        });
        const missing = persisted.filter(item => !previousByName.has(discoveryIdentity(item.name)));
        return updatedArtwork || missing.length ? sanitizeElements([...updated, ...missing]) : current;
      });
    };
    window.addEventListener(SAVE_CHANGED_EVENT, update);
    return () => window.removeEventListener(SAVE_CHANGED_EVENT, update);
  }, []);

  useEffect(() => {
    const update = () => setElements(sanitizeElements(readCraftElements()));
    window.addEventListener(PROFILE_SPRITES_UPDATED, update);
    return () => window.removeEventListener(PROFILE_SPRITES_UPDATED, update);
  }, []);

  const [savedBoardLayout] = useState(() => loadBoardLayout(readCraftElements()));
  const autoFrameStarters = useRef(savedBoardLayout === null);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(() => savedBoardLayout ?? [
    { instanceId: 'init-1', name: 'Water', emoji: '💧', x: BOARD_START_X, y: BOARD_START_Y },
    { instanceId: 'init-2', name: 'Fire', emoji: '🔥', x: BOARD_START_X + 166, y: BOARD_START_Y },
    { instanceId: 'init-3', name: 'Wind', emoji: '💨', x: BOARD_START_X, y: BOARD_START_Y + 96 },
    { instanceId: 'init-4', name: 'Earth', emoji: '🌍', x: BOARD_START_X + 166, y: BOARD_START_Y + 96 },
  ]);
  const historyRef = useRef(beginBoardHistory(canvasItems));
  const skipHistoryRef = useRef(false);
  const [historySize, setHistorySize] = useState({past:0,future:0});
  useEffect(() => {
    historyRef.current = skipHistoryRef.current
      ? {...historyRef.current,present:canvasItems}
      : recordBoardHistory(historyRef.current,canvasItems);
    skipHistoryRef.current = false;
    setHistorySize({past:historyRef.current.past.length,future:historyRef.current.future.length});
    saveBoardLayout(canvasItems);
  }, [canvasItems]);
  const undoLayout = () => {
    if (requestRef.current || procedureRequest.current || foundryBusy) return;
    const next=undoBoard(historyRef.current);
    if(next===historyRef.current)return;
    historyRef.current=next;skipHistoryRef.current=true;setCanvasItems(next.present);setSelectedCanvasId(null);setSecondSelectedCanvasId(null);haptics.lightTap();
  };
  const redoLayout = () => {
    if (requestRef.current || procedureRequest.current || foundryBusy) return;
    const next=redoBoard(historyRef.current);
    if(next===historyRef.current)return;
    historyRef.current=next;skipHistoryRef.current=true;setCanvasItems(next.present);setSelectedCanvasId(null);setSecondSelectedCanvasId(null);haptics.lightTap();
  };
  const [boardZoom,setBoardZoom] = useState(()=>{
    try {return clampBoardZoom(Number(localStorage.getItem('boop-board-zoom')||'1')); }
    catch {return 1;}
  });
  const zoomRef=useRef(boardZoom);
  zoomRef.current=boardZoom;

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'time' | 'alpha' | 'discoveries' | 'shinies' | 'crafted'>('time');
  const isDarkMode = false;
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const [secondSelectedCanvasId, setSecondSelectedCanvasId] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeCombination, setActiveCombination] = useState<ActiveCombination | null>(null);

  const [crucibleSlotA, setCrucibleSlotA] = useState<CrucibleSlotItem | null>(null);
  const [crucibleSlotB, setCrucibleSlotB] = useState<CrucibleSlotItem | null>(null);
  const [spawnCount, setSpawnCount] = useState<SpawnCount>(2);
  const [spawnSource, setSpawnSource] = useState<SpawnSource>('all');
  const [spawnCategory, setSpawnCategory] = useState('all');
  const [spawnRarity, setSpawnRarity] = useState<SmartRarity>('all');
  const [advancedFusionOpen, setAdvancedFusionOpen] = useState(false);
  const spawnSequenceRef = useRef(0);
  const crucibleRef = useRef<HTMLDivElement | null>(null);

  const [firstDiscoveryModal, setFirstDiscoveryModal] = useState<InfiniteElement | null>(null);
  const [inspectedElement, setInspectedElement] = useState<InfiniteElement | null>(null);
  const [revealBurst, setRevealBurst] = useState<{ id: number; isRare: boolean } | null>(null);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const open=()=>{
      let requested=false;
      try{ requested=sessionStorage.getItem('boop-open-advanced-fusion')==='1';
        if(requested)sessionStorage.removeItem('boop-open-advanced-fusion');
      }catch{/* optional navigation intent */}
      if(requested)setAdvancedFusionOpen(true);
    };
    const onRequest=()=>{open();setAdvancedFusionOpen(true)};
    window.addEventListener('boop-open-advanced-fusion',onRequest);
    open();
    return ()=>window.removeEventListener('boop-open-advanced-fusion',onRequest);
  },[]);
  const [viewportPixelWidth, setViewportPixelWidth] = useState(380);
  const [viewportPixelHeight, setViewportPixelHeight] = useState(0);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (height > 0) setViewportPixelHeight(old => old === height ? old : height);
      if (width > 0) setViewportPixelWidth(old => old === width ? old : width);
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  // CSS zoom changes the world-unit width available to each pill. Truncate
  // unusually long item names rather than letting a spawn exceed the screen.
  const spawnTileMaxWidth = Math.min(260, Math.max(74, viewportPixelWidth / boardZoom - 24));
  const currentWorldViewport = (): SpawnViewport | null => {
    const viewport = viewportRef.current;
    const zoom = zoomRef.current;
    return viewport && viewport.clientWidth > 0 && viewport.clientHeight > 0 ? {
      scrollLeft: viewport.scrollLeft / zoom,
      scrollTop: viewport.scrollTop / zoom,
      clientWidth: viewport.clientWidth / zoom,
      clientHeight: viewport.clientHeight / zoom,
    } : null;
  };
  const setZoomPreservingCenter = (value:number) => {
    const next=clampBoardZoom(value),prior=zoomRef.current;
    if(next===prior)return;
    const viewport=viewportRef.current;
    const centerX=viewport?(viewport.scrollLeft+viewport.clientWidth/2)/prior:0;
    const centerY=viewport?(viewport.scrollTop+viewport.clientHeight/2)/prior:0;
    zoomRef.current=next;setBoardZoom(next);
    try{localStorage.setItem('boop-board-zoom',String(next));}catch{/* optional UI preference */}
    if(viewport)requestAnimationFrame(()=>{
      viewport.scrollLeft=centerX*next-viewport.clientWidth/2;
      viewport.scrollTop=centerY*next-viewport.clientHeight/2;
    });
  };
  useEffect(()=>{
    const viewport=viewportRef.current;
    if(!viewport)return;
    let pinch:{distance:number;zoom:number}|null=null;
    const distance=(a:Touch,b:Touch)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    const start=(e:TouchEvent)=>{
      if(e.touches.length===2)pinch={distance:Math.max(1,distance(e.touches[0],e.touches[1])),zoom:zoomRef.current};
    };
    const move=(e:TouchEvent)=>{
      if(e.touches.length!==2||!pinch)return;
      e.preventDefault();
      setZoomPreservingCenter(pinch.zoom*distance(e.touches[0],e.touches[1])/pinch.distance);
    };
    const end=(e:TouchEvent)=>{if(e.touches.length<2)pinch=null;};
    const wheel=(e:WheelEvent)=>{
      if(!e.ctrlKey)return;
      e.preventDefault();
      setZoomPreservingCenter(zoomRef.current*(e.deltaY<0?1.08:.92));
    };
    viewport.addEventListener('touchstart',start,{passive:true});
    viewport.addEventListener('touchmove',move,{passive:false});
    viewport.addEventListener('touchend',end);
    viewport.addEventListener('wheel',wheel,{passive:false});
    return ()=>{
      viewport.removeEventListener('touchstart',start);viewport.removeEventListener('touchmove',move);
      viewport.removeEventListener('touchend',end);viewport.removeEventListener('wheel',wheel);
    };
  }, []);
  const panningRef = useRef<{ id: number; startX: number; startY: number; scrollX: number; scrollY: number } | null>(null);
  const hasFramedBoard = useRef(false);
  const [mergeFx, setMergeFx] = useState<{ id: number; x: number; y: number; dxA: number; dyA: number; dxB: number; dyB: number; a: string; b: string } | null>(null);
  const mergeFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (autoFrameStarters.current) {
      const worldWidth = viewport.clientWidth / boardZoom;
      if (!worldWidth) return;
      const columns = worldWidth >= 800 ? 4 : worldWidth >= 272 ? 2 : 1;
      const tileWidth = worldWidth >= 600 ? 156 : worldWidth < 320 ? 120 : 136;
      const tileHeight = tileWidth === 156 ? 120 : tileWidth === 120 ? 96 : 104;
      const columnStep = tileWidth + (columns === 4 ? 36 : worldWidth >= 600 ? 64 : 24);
      const groupWidth = (columns - 1) * columnStep + tileWidth;
      const topInset = worldWidth >= 600 ? 12 : 24;
      const rowStep = Math.max(tileHeight + 4, Math.min(tileWidth + 32, viewport.clientHeight / boardZoom - topInset - 12 - tileHeight));
      const items = canvasItemsRef.current;
      if (items.every(item => item.instanceId.startsWith('init-'))) {
        const framed = items.map((item, index) => ({ ...item, x: BOARD_START_X + index % columns * columnStep,
          y: BOARD_START_Y + Math.floor(index / columns) * rowStep }));
        historyRef.current = beginBoardHistory(framed);
        skipHistoryRef.current = true;
        setCanvasItems(framed);
      }
      viewport.scrollLeft = BOARD_START_X * boardZoom - Math.max(12, (viewport.clientWidth - groupWidth * boardZoom) / 2);
      viewport.scrollTop = BOARD_START_Y * boardZoom - topInset * boardZoom;
    } else if (!hasFramedBoard.current) {
      viewport.scrollLeft = BOARD_START_X * boardZoom - Math.min(220, viewport.clientWidth / 4);
      viewport.scrollTop = BOARD_START_Y * boardZoom - Math.min(160, viewport.clientHeight / 3);
    }
    hasFramedBoard.current = true;
  }, [viewportPixelWidth, viewportPixelHeight, boardZoom]);
  useEffect(() => () => { if (mergeFxTimerRef.current) clearTimeout(mergeFxTimerRef.current); }, []);

  // A bare-area drag pans on desktop. Touch uses the browser's native kinetic
  // scrolling for silky, low-latency movement on Android.
  const startPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || e.button !== 0 || (e.target as HTMLElement).closest('[data-craft-instance],button')) return;
    panningRef.current = { id:e.pointerId, startX:e.clientX, startY:e.clientY,
      scrollX:e.currentTarget.scrollLeft, scrollY:e.currentTarget.scrollTop };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const movePan = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panningRef.current;
    if (!pan || pan.id !== e.pointerId) return;
    e.currentTarget.scrollLeft = pan.scrollX + pan.startX - e.clientX;
    e.currentTarget.scrollTop = pan.scrollY + pan.startY - e.clientY;
  };
  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panningRef.current?.id === e.pointerId) panningRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const [spawnToast, setSpawnToast] = useState<string | null>(null);
  // Toasts should never cover the board permanently, including full-board
  // and empty-source messages from the random spawn menu.
  useEffect(() => {
    if (!spawnToast) return;
    const timer = window.setTimeout(() => setSpawnToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [spawnToast]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const canvasItemsRef = useRef(canvasItems);
  canvasItemsRef.current = canvasItems;
  const rafPendingRef = useRef(false);
  const draggingItemRef = useRef<{
    instanceId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    originX: number;
    originY: number;
    pointerId: number;
    node: HTMLDivElement;
    startRect: DOMRect;
    targets: Array<{ item: HTMLDivElement; rect: DOMRect }> | null;
    moved: boolean;
  } | null>(null);
  const hoveredNodeRef = useRef<HTMLDivElement | null>(null);
  const suppressCanvasClickRef = useRef(false);

  useEffect(() => {
    // Keep new discoveries immediately visible to other tabs, but avoid
    // validating and serializing the whole image-heavy save in the same
    // frame as the result reveal. A background/pagehide flush guards progress.
    try { queueCraftElementsSave(elements, sanitizeElements); }
    catch (e) { console.error('Failed to queue infinite craft save', e); }
  }, [elements]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      if (target?.matches('input,textarea,select,[contenteditable="true"]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); if (e.shiftKey) redoLayout(); else undoLayout();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redoLayout();
      } else if (e.key === 'Escape') {
        if (firstDiscoveryModal) setFirstDiscoveryModal(null);
        else if (inspectedElement) setInspectedElement(null);
        else if (selectedCanvasId || secondSelectedCanvasId) { setSelectedCanvasId(null); setSecondSelectedCanvasId(null); }
        else if (isSidebarOpen && window.innerWidth < 1024) setIsSidebarOpen(false);
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        setIsSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [firstDiscoveryModal, inspectedElement, selectedCanvasId, secondSelectedCanvasId, isSidebarOpen, isSynthesizing]);

  // One DOM burst per reveal; CSS handles the motion on the compositor.
  // The previous 24ms particle setInterval rerendered the entire craft view
  // throughout each burst, stuttering when many collection cards were visible.
  useEffect(() => () => {
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
  }, []);

  const spawnRevealBurst = (isRare: boolean) => {
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    setRevealBurst({ id: Date.now(), isRare });
    burstTimerRef.current = setTimeout(() => setRevealBurst(null), 800);
  };

  const collectionStats = useMemo(() => getCollectionStats(elements), [elements]);

  // Shared discoveries, re-applied from PR #107 as a derived view only: Craft
  // elements already include Foundry items merged on save load, but Foundry
  // materials discovered while Craft is mounted surface here immediately,
  // without rewriting either saved collection. Saved state still uses
  // `elements` (see the save effect), never this derived list.
  const sharedElements = useMemo(() => mergeSharedDiscoveries(elements, foundryMaterials, foundryOddkin), [elements, foundryMaterials, foundryOddkin]);
  const valueBook = useMemo(() => buildCollectionValueBook(elements), [elements]);

  const filteredElements = useMemo(() => {
    let list = sanitizeElements(sharedElements);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(el => {
        if (el.name.toLowerCase().includes(q)) return true;
        const hasShiny = Boolean(el.unlockedShiny || el.isShiny);
        if (q === 'shiny' && hasShiny) return true;
        const mastery = getElementMastery(el.craftCount || 0);
        if (mastery.label.toLowerCase().includes(q)) return true;
        const phys = el.physicalData || generatePhysicalData(el.name, el.emoji, Boolean(el.isShiny));
        return phys.stateOfMatter.toLowerCase().includes(q) || phys.temperatureClass.toLowerCase().includes(q) || phys.conductivity.toLowerCase().includes(q) || phys.elementalAspect.toLowerCase().includes(q) || phys.cosmicTier.toLowerCase().includes(q) || phys.massClass.toLowerCase().includes(q);
      });
    }
    if (sortMode === 'time') list.sort((a, b) => (b.lastCraftedAt || b.discoveredAt || 0) - (a.lastCraftedAt || a.discoveredAt || 0));
    else if (sortMode === 'alpha') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === 'discoveries') list = list.filter(el => el.isNew);
    else if (sortMode === 'shinies') list = list.filter(el => Boolean(el.unlockedShiny || el.isShiny)).sort((a, b) => (b.shinyCraftCount || 0) - (a.shinyCraftCount || 0));
    else if (sortMode === 'crafted') list.sort((a, b) => (b.craftCount || 0) - (a.craftCount || 0));
    return list;
  }, [sharedElements, searchQuery, sortMode]);

  const [combineError, setCombineError] = useState<string | null>(null);
  const lastPairRef = useRef<Parameters<typeof handleCombine> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    requestRef.current?.abort();
  }, []);

  const handleCombine = async (
    itemA: { name: string; emoji?: string; x: number; y: number; idA?: string },
    itemB: { name: string; emoji?: string; x: number; y: number; idB?: string }
  ) => {
    if (requestRef.current || procedureRequest.current || foundryBusy) return;
    const controller = new AbortController();
    requestRef.current = controller;
    lastPairRef.current = [itemA, itemB];
    setCombineError(null);
    setIsSynthesizing(true);
    sound.playCombineChime();

    const targetX = (itemA.x + itemB.x) / 2;
    const targetY = (itemA.y + itemB.y) / 2;
    setActiveCombination({ idA: itemA.idA || 'a', idB: itemB.idB || 'b', nameA: itemA.name, emojiA: itemA.emoji || '✨', x1: itemA.x, y1: itemA.y, nameB: itemB.name, emojiB: itemB.emoji || '✨', x2: itemB.x, y2: itemB.y, midX: targetX, midY: targetY });
    if (mergeFxTimerRef.current) clearTimeout(mergeFxTimerRef.current);
    setMergeFx({ id: Date.now(), x: targetX, y: targetY,
      dxA:itemA.x-targetX, dyA:itemA.y-targetY, dxB:itemB.x-targetX, dyB:itemB.y-targetY,
      a:itemA.name, b:itemB.name });
    mergeFxTimerRef.current = setTimeout(() => setMergeFx(null), 330);

    try {
      // Both Craft and Foundry MIX resolve through one pair endpoint,
      // including the same canonical shortcuts, provider and persistent cache.
      const apiData = await resolveSharedPair(itemA.name, itemB.name, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const rolls = rollSharedPair(apiData.result, itemA.name, itemB.name);
      const isShinyEncounter = rolls.shiny;
      const isCelestialEncounter = rolls.celestial;
      const isHoloEncounter = rolls.holo;
      const isGlitchEncounter = rolls.glitch;
      if (isShinyEncounter) setActiveCombination(prev => prev ? { ...prev, isShiny: true } : null);
      const craftedAt = Date.now();
      const recorded = applySharedPairDiscovery(elements, apiData, itemA.name, itemB.name, rolls, craftedAt);
      const { result, emoji } = apiData;
      const cleanName = recorded.main.name;
      const firstInCollection = recorded.isNew;
      const isNew = firstInCollection;
      const newElemObj = recorded.main;
      if (isShinyEncounter || firstInCollection) spawnRevealBurst(true);
      setLastResult(newElemObj);

      // Background art is best effort and subject to Boop's existing AI cap.
      if (firstInCollection) enqueueArtwork(cleanName, false);
      if (isShinyEncounter) enqueueArtwork(cleanName, true);
      if (recorded.bonus) enqueueArtwork(recorded.bonus.name, false);
      // Use the newest in-memory collection, so a Foundry discovery cannot be
      // lost if the player switched modes during an asynchronous pair request.
      setElements(prev => applySharedPairDiscovery(prev, apiData, itemA.name, itemB.name, rolls, craftedAt).elements);

      const bonus = recorded.bonus;
      if (bonus) {
        setSpawnToast(`✦ Rare bonus: ${bonus.name}! ${cleanName} was also saved.`);
        setTimeout(() => setSpawnToast(null), 4500);
      }

      if (isCelestialEncounter) {
        sound.playShiny();
        haptics.shinySparkle();
        setSpawnToast(`✶ CELESTIAL ${cleanName.toUpperCase()}! Ultra-rare variant unlocked.`);
      } else if (isShinyEncounter) {
        const foil = getShinyFoilStyle(cleanName);
        sound.playShiny();
        haptics.shinySparkle();
        if (!bonus) setSpawnToast(`✨ ${foil.name.toUpperCase()} SHINY ${cleanName.toUpperCase()}!`);
        setTimeout(() => setSpawnToast(null), 3000);
      } else if (isGlitchEncounter || isHoloEncounter) {
        sound.playShiny();
        haptics.shinySparkle();
        setSpawnToast(`${isGlitchEncounter?'⟡ GLITCH':'◈ HOLO'} FINISH UNLOCKED · ${cleanName}`);
      } else if (firstInCollection) {
        sound.playFirstDiscoveryChime();
        haptics.firstDiscovery();
        setSpawnToast(null);
      } else {
        sound.playCraftPop();
        haptics.lightTap();
      }

      setCanvasItems(prev => {
        const filtered = prev.filter(it => it.instanceId !== itemA.idA && it.instanceId !== itemB.idB);
        return [...filtered, { instanceId: `fusion-${Date.now()}-${Math.random()}`, name: cleanName, emoji: emoji || '✨', ...clampBoardTile(targetX, targetY), isNew, isShiny: isShinyEncounter }];
      });
      setCrucibleSlotA(null);
      setCrucibleSlotB(null);
    } catch (err) {
      haptics.warning();
      if (!controller.signal.aborted) setCombineError(err instanceof Error ? err.message : 'Combination failed. Please retry.');
    } finally {
      requestRef.current = null;
      setActiveCombination(null);
      setIsSynthesizing(false);
      setSelectedCanvasId(null);
      setSecondSelectedCanvasId(null);
      if (hoveredNodeRef.current) hoveredNodeRef.current.classList.remove('is-drop-target');
      hoveredNodeRef.current = null;

    }
  };

  const handleCrucibleCombine = () => {
    if (!crucibleSlotA || !crucibleSlotB) return;
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const midX = canvasBounds ? canvasBounds.width / 2 : 250;
    const midY = canvasBounds ? canvasBounds.height / 2 - 40 : 200;
    handleCombine({ name: crucibleSlotA.name, emoji: crucibleSlotA.emoji, x: midX - 60, y: midY, idA: crucibleSlotA.id }, { name: crucibleSlotB.name, emoji: crucibleSlotB.emoji, x: midX + 60, y: midY, idB: crucibleSlotB.id });
  };

  const handleSwapCrucible = () => { const temp = crucibleSlotA; setCrucibleSlotA(crucibleSlotB); setCrucibleSlotB(temp); };

  const dropIntoCrucible = (item: { name: string; emoji: string; instanceId?: string; isShiny?: boolean }) => {
    if (!crucibleSlotA) { setCrucibleSlotA({ id: item.instanceId, name: item.name, emoji: item.emoji, isShiny: item.isShiny }); if (item.instanceId) setCanvasItems(prev => prev.filter(it => it.instanceId !== item.instanceId)); }
    else if (!crucibleSlotB) { setCrucibleSlotB({ id: item.instanceId, name: item.name, emoji: item.emoji, isShiny: item.isShiny }); if (item.instanceId) setCanvasItems(prev => prev.filter(it => it.instanceId !== item.instanceId)); }
    else { setCrucibleSlotB({ id: item.instanceId, name: item.name, emoji: item.emoji, isShiny: item.isShiny }); if (item.instanceId) setCanvasItems(prev => prev.filter(it => it.instanceId !== item.instanceId)); }
  };

  const handleCanvasItemClick = (item: CanvasItem) => {
    if (suppressCanvasClickRef.current || requestRef.current || procedureRequest.current || foundryBusy) return;
    sound.playClick(); haptics.lightTap();
    if (selectedCanvasId === item.instanceId) {
      setSelectedCanvasId(secondSelectedCanvasId); setSecondSelectedCanvasId(null);
    } else if (secondSelectedCanvasId === item.instanceId) setSecondSelectedCanvasId(null);
    else if (!selectedCanvasId) setSelectedCanvasId(item.instanceId);
    else setSecondSelectedCanvasId(item.instanceId);
  };

  const handleDuplicate = (item: CanvasItem, e: React.MouseEvent) => {
    e.stopPropagation(); sound.playClick(); haptics.mediumTap();
    setCanvasItems(prev => [...prev, { ...item, instanceId: `dup-${Date.now()}-${Math.random()}`, x: item.x + 25, y: item.y + 25 }]);
  };

  const handleRemoveFromCanvas = (instanceId: string, e: React.MouseEvent) => {
    e.stopPropagation(); sound.playClick(); setCanvasItems(prev => prev.filter(it => it.instanceId !== instanceId)); if (selectedCanvasId === instanceId) setSelectedCanvasId(null);
  };

  const spawnOnCanvas = (name: string, emoji: string, isShiny = false) => {
    sound.playClick(); haptics.lightTap();
    if (canvasItemsRef.current.length >= 300) {
      setSpawnToast('Board is full. Clear or remove tiles to spawn more.');
      return;
    }
    const viewport = currentWorldViewport();
    const sequence = ++spawnSequenceRef.current;
    const spot = spreadSpawnPositions(spawnPositions(1, viewport), canvasItemsRef.current, sequence, viewport)[0];
    const newItem: CanvasItem = { instanceId: `spawn-${Date.now()}-${sequence}`, name, emoji, ...spot, isShiny };
    setCanvasItems(prev => [...prev, newItem].slice(0, 300));
    setSpawnToast(`${emoji} ${isShiny ? '✨ ' : ''}${name} added`);
    setTimeout(() => setSpawnToast(null), 1800);
    // Picking from the library adds a tile; it must not unexpectedly fuse
    // with a board selection. Players intentionally tap two tiles to combine.
  };

  const spawnFromSidebar = (raw: InfiniteElement) => {
    const el = normalizeElementStats(raw);
    const isShinyUnlocked = Boolean(el.unlockedShiny || el.isShiny);
    const isShiny = Boolean(el.isShiny || (sortMode === 'shinies' && isShinyUnlocked));
    spawnOnCanvas(el.name, el.emoji, isShiny);
  };

  const tidyCanvas = () => {
    if (!canvasItems.length || procedureRequest.current || requestRef.current) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    autoFrameStarters.current = false;
    const sizes = new Map<string, { width: number; height: number }>();
    canvasRef.current?.querySelectorAll<HTMLElement>('[data-craft-instance]').forEach(node => {
      const rect = node.getBoundingClientRect();
      sizes.set(node.dataset.craftInstance!, { width: rect.width / zoomRef.current, height: rect.height / zoomRef.current });
    });
    const layout = tidyBoard(canvasItems.map(item => ({ instanceId: item.instanceId,
      ...(sizes.get(item.instanceId) || { width: 136, height: 120 }) })), {
      width: viewport.clientWidth, height: viewport.clientHeight,
      left: viewport.scrollLeft / zoomRef.current, top: viewport.scrollTop / zoomRef.current,
    }, zoomRef.current);
    zoomRef.current = layout.zoom; setBoardZoom(layout.zoom);
    try { localStorage.setItem('boop-board-zoom', String(layout.zoom)); } catch { /* optional */ }
    const positions = new Map(layout.positions.map(position => [position.instanceId, position]));
    setCanvasItems(previous => previous.map(item => ({ ...item, ...positions.get(item.instanceId) })));
    requestAnimationFrame(() => { viewport.scrollLeft = layout.left * layout.zoom; viewport.scrollTop = layout.top * layout.zoom; });
    setSpawnToast(layout.fits ? 'Board tidied to fit your screen.' : 'Board tidied into columns. Pan down to see the remaining pieces.');
    sound.playClick();
  };

  const handlePointerDown = (item: CanvasItem, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.boop-tile-action')) return;
    e.stopPropagation();
    autoFrameStarters.current = false;
    sound.unlock();
    suppressCanvasClickRef.current = false;
    draggingItemRef.current = {
      instanceId: item.instanceId,
      startX: e.clientX, startY: e.clientY,
      currentX: e.clientX, currentY: e.clientY,
      originX: item.x, originY: item.y,
      pointerId: e.pointerId, node: e.currentTarget,
      startRect: e.currentTarget.getBoundingClientRect(),
      targets: null,
      moved: false,
    };
  };

  // Stable event delegates let React.memo skip every unchanged canvas tile,
  // while the handlers still see the latest combination and selection state.
  const boardActions = useRef({ handlePointerDown, handleCanvasItemClick, handleDuplicate, handleRemoveFromCanvas });
  boardActions.current = { handlePointerDown, handleCanvasItemClick, handleDuplicate, handleRemoveFromCanvas };
  const onBoardPointerDown = useCallback((item: CanvasItem, event: React.PointerEvent<HTMLDivElement>) => boardActions.current.handlePointerDown(item, event), []);
  const onBoardClick = useCallback((item: CanvasItem) => boardActions.current.handleCanvasItemClick(item), []);
  const onBoardDuplicate = useCallback((item: CanvasItem, event: React.MouseEvent) => boardActions.current.handleDuplicate(item, event), []);
  const onBoardRemove = useCallback((id: string, event: React.MouseEvent) => boardActions.current.handleRemoveFromCanvas(id, event), []);

  const interactions = useRef({ dropIntoCrucible, handleCombine });
  interactions.current = { dropIntoCrucible, handleCombine };
  useEffect(() => {
    const position = (drag: NonNullable<typeof draggingItemRef.current>) => ({
      x: drag.originX + (drag.currentX - drag.startX) / zoomRef.current,
      y: drag.originY + (drag.currentY - drag.startY) / zoomRef.current,
    });
    const applyDragPosition = (drag: NonNullable<typeof draggingItemRef.current>) => {
      const { x, y } = position(drag);
      // Directly move the active pill; rerendering an entire collection each
      // pointer frame produces visible stutter on mid-range Android devices.
      drag.node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const hitTarget = (drag: NonNullable<typeof draggingItemRef.current>) => {
      const dx = drag.currentX - drag.startX;
      const dy = drag.currentY - drag.startY;
      // Geometry is captured once when dragging begins. Avoid DOM reads and React
      // state updates every frame so the pill stays under the finger at 60fps.
      const moving = {
        left: drag.startRect.left + dx, top: drag.startRect.top + dy,
        width: drag.startRect.width, height: drag.startRect.height,
      };
      return findCraftDropTarget<HTMLDivElement>(moving, drag.targets || [], { x: drag.currentX, y: drag.currentY });
    };
    const processDragFrame = () => {
      rafPendingRef.current = false;
      const drag = draggingItemRef.current;
      if (!drag || !drag.moved) return;
      if (!drag.targets) {
        drag.targets = (Array.from(canvasRef.current?.querySelectorAll('[data-craft-instance]') || []) as HTMLDivElement[])
          .filter(node => node !== drag.node)
          .map(node => ({ item: node, rect: node.getBoundingClientRect() }));
      }
      applyDragPosition(drag);
      const target = hitTarget(drag);
      if (hoveredNodeRef.current !== target) {
        hoveredNodeRef.current?.classList.remove('is-drop-target');
        if (target) target.classList.add('is-drop-target');
        hoveredNodeRef.current = target;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const drag = draggingItemRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      drag.currentX = e.clientX;
      drag.currentY = e.clientY;
      if (!drag.moved) {
        if (Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY) < 5) return;
        drag.moved = true;
        drag.node.classList.add('is-dragging');
        suppressCanvasClickRef.current = true;
      }
      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(processDragFrame);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const drag = draggingItemRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      drag.currentX = e.clientX;
      drag.currentY = e.clientY;
      const moved = drag.moved && e.type !== 'pointercancel';
      if (moved) {
        if (!drag.targets) {
          drag.targets = (Array.from(canvasRef.current?.querySelectorAll('[data-craft-instance]') || []) as HTMLDivElement[])
            .filter(node => node !== drag.node)
            .map(node => ({ item: node, rect: node.getBoundingClientRect() }));
        }
        applyDragPosition(drag); // Read accurate position even between animation frames.
        const { x, y } = position(drag);
        const item = canvasItemsRef.current.find(it => it.instanceId === drag.instanceId);
        const targetNode = hitTarget(drag);
        const other = canvasItemsRef.current.find(it => it.instanceId === targetNode?.dataset.craftInstance);
        const crucibleRect = crucibleRef.current?.getBoundingClientRect();
        const overCrucible = Boolean(crucibleRect && e.clientX >= crucibleRect.left && e.clientX <= crucibleRect.right
          && e.clientY >= crucibleRect.top && e.clientY <= crucibleRect.bottom);
        if (item) {
          // Preserve normal dragging even if a combination request is still loading.
          setCanvasItems(prev => prev.map(it => it.instanceId === item.instanceId ? { ...it, x, y } : it));
          if (overCrucible) interactions.current.dropIntoCrucible({ ...item, x, y });
          else if (other) interactions.current.handleCombine(
            { name: item.name, emoji: item.emoji, x, y, idA: item.instanceId },
            { name: other.name, emoji: other.emoji, x: other.x, y: other.y, idB: other.instanceId },
          );
        }
      } else if (e.type === 'pointercancel') {
        drag.node.style.transform = `translate3d(${drag.originX}px, ${drag.originY}px, 0)`;
      }
      draggingItemRef.current = null;
      drag.node.classList.remove('is-dragging');
      hoveredNodeRef.current?.classList.remove('is-drop-target');
      hoveredNodeRef.current = null;

      if (suppressCanvasClickRef.current) window.setTimeout(() => { suppressCanvasClickRef.current = false; }, 80);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      hoveredNodeRef.current?.classList.remove('is-drop-target');
      hoveredNodeRef.current = null;
    };
  }, []);

  const clearCanvas = () => { if (procedureRequest.current || requestRef.current || foundryBusy) return; sound.playClick(); haptics.heavyTap(); setCanvasItems([]); setSelectedCanvasId(null); setSecondSelectedCanvasId(null); };
  const lastCustomSprites = useRef<ReadonlyMap<string, string>>(new Map());
  const customSprites = useMemo(() => {
    const next = new Map<string, string>();
    for (const item of elements) if (item.customSpriteUrl) next.set(discoveryIdentity(item.name), item.customSpriteUrl);
    // Foundry uploads should appear on the Craft board even when an older
    // Craft copy of the concept has no sprite of its own.
    for (const item of foundryMaterials) {
      const key = discoveryIdentity(item.displayName);
      if (!next.has(key) && item.customSpriteUrl && !isProceduralDefault(item)) next.set(key, item.customSpriteUrl);
    }
    // Sprite updates for live Oddkin should appear without changing tabs.
    for (const oddkin of foundryOddkin) {
      const key = discoveryIdentity(oddkin.speciesName);
      if (!next.has(key) && oddkin.customSpriteUrl) next.set(key, oddkin.customSpriteUrl);
    }
    const previous = lastCustomSprites.current;
    if (next.size === previous.size && [...next].every(([name, url]) => previous.get(name) === url)) return previous;
    lastCustomSprites.current = next;
    return next;
  }, [elements, foundryMaterials, foundryOddkin]);

  const selectIngredient = (element: InfiniteElement) => {
    spawnOnCanvas(element.name, element.emoji, Boolean(element.isShiny));
  };
  const ingredientList = useMemo(() =>
    filteredElements.filter(el => ingredientFilter === 'all' || (ingredientFilter === 'new' ? el.isNew : el.unlockedShiny || el.isShiny)),
    [filteredElements, ingredientFilter],
  );
  const recent = useMemo(() =>
    [...elements].filter(el => el.discoveredAt > 0).sort((a, b) => b.discoveredAt - a.discoveredAt).slice(0, 5),
    [elements],
  );

  // Smart randomizer: filter the player's existing discoveries only.
  // Uniform draw within that pool, with no unlocks or AI requests.
  const spawnCategoryIndex=useMemo(()=>buildCollectionCategoryIndex(sharedElements),[sharedElements]);
  const spawnCategories=useMemo(()=>smartSpawnCategories(sharedElements,{source:spawnSource,rarity:spawnRarity},spawnCategoryIndex),[sharedElements,spawnSource,spawnRarity,spawnCategoryIndex]);
  useEffect(()=>{if(spawnCategory!=='all'&&!spawnCategories.some(entry=>entry.name===spawnCategory))setSpawnCategory('all');},[spawnCategory,spawnCategories]);
  const spawnPool = useMemo(() => smartSpawnPool(sharedElements,
    {source:spawnSource,category:spawnCategory,rarity:spawnRarity},spawnCategoryIndex),
    [sharedElements,spawnSource,spawnCategory,spawnRarity,spawnCategoryIndex]);

  const spawnRandomBatch = (count: SpawnCount, suggestion?: InfiniteElement[], selectPair = false) => {
    if (!selectPair) setSpawnCount(count);
    if (!spawnPool.length) {
      setSpawnToast('Discover an element first.');
      return;
    }
    const remaining = Math.max(0, 300 - canvasItemsRef.current.length);
    if (!remaining) {
      setSpawnToast('Board is full. Clear or remove tiles to spawn more.');
      return;
    }
    const picked = (suggestion || chooseSpawnElements<InfiniteElement>(spawnPool, count)).slice(0, remaining);
    const viewport = currentWorldViewport();
    const baseSpots = spawnPositions(picked.length, viewport);
    const batchId = ++spawnSequenceRef.current;
    // Repeated taps spread new pills around those already visible rather than
    // stacking an identical batch right on top of its predecessor.
    const spots = spreadSpawnPositions(baseSpots,canvasItemsRef.current,batchId,viewport);
    const tiles: CanvasItem[] = picked.map((item, index) => ({
      instanceId: `spawn-${Date.now()}-${batchId}-${index}`,
      name: item.name,
      emoji: item.emoji,
      isShiny: Boolean(item.isShiny),
      spawnDelay: Math.min(index,9)*34,
      ...spots[index],
    }));
    haptics.mediumTap();
    sound.playClick();
    setCanvasItems(previous => [...previous, ...tiles].slice(0, 300));
    if (selectPair && tiles.length === 2) {
      setSelectedCanvasId(tiles[0].instanceId); setSecondSelectedCanvasId(tiles[1].instanceId);
      setProcedureId('MIX');
    }
    if (picked.length < count) setSpawnToast(`✦ +${picked.length} elements · Board full`);
    else setSpawnToast(suggestion ? `Try ${picked[0].name} + ${picked[1].name}`
      : `✦ +${picked.length} random ${picked.length===1?'element':'elements'} · 1/${spawnPool.length} per first pick`);
  };

  const fuseAdvanced = (plan:FusionPlan) => {
    if(requestRef.current||isSynthesizing)return;
    // Roll once outside any React state-updater callback; the shared ledger
    // writes the same recipes, rarity and finishes as ordinary two-item Craft.
    const rolls=plan.steps.map(step=>rollSharedPair(step.result,step.first,step.second));
    const at=Date.now();
    const result=applyAdvancedFusion(elements,plan,rolls,at);
    setElements(prev=>applyAdvancedFusion(prev,plan,rolls,at).elements);
    setLastResult({...result.final,isNew:result.newDiscoveries>0});
    setSpawnToast(`Advanced Fusion: ${plan.steps.length} known stages → ${result.final.name}. No AI credits used.`);
    if(result.newDiscoveries)spawnRevealBurst(true);
    sound.playCraftPop();haptics.mediumTap();
  };

  // Reuse callback references so memoized discovery cards are skipped entirely
  // when only the slot contents or the random-button animation changes.
  const ingredientPickRef = useRef<(item: InfiniteElement) => void>(() => undefined);
  ingredientPickRef.current = (item: InfiniteElement) => {
    if (showFreeform) spawnFromSidebar(item);
    else selectIngredient(item);
  };
  const handleIngredientPick = useCallback((item: InfiniteElement) => ingredientPickRef.current(item), []);
  const handleIngredientInspect = useCallback((item: InfiniteElement) => setInspectedElement(item), []);

  const motionCategories = useMemo(() => new Map(sharedElements.map(element => [discoveryIdentity(element.name), element.category])), [sharedElements]);
  const meaningLabels = useMemo(() => new Map(sharedElements.map(element => [discoveryIdentity(element.name), displayConceptName(element)])), [sharedElements]);

  const selectedPieces = [selectedCanvasId, secondSelectedCanvasId]
    .flatMap(id => { const item = canvasItems.find(tile => tile.instanceId === id); return item ? [item] : []; });
  const combineSelected = () => {
    if (selectedPieces.length !== 2 || requestRef.current) return;
    const [first, second] = selectedPieces;
    void handleCombine({ ...first, idA: first.instanceId }, { ...second, idB: second.instanceId });
  };
  const activeProcedure = procedureCatalog.find(process => process.id === procedureId) || procedureCatalog.find(process => process.id === 'MIX');
  const applyProcedure = async () => {
    if (!activeProcedure || !selectedPieces.length || procedureRequest.current || requestRef.current || foundryBusy) return;
    if (activeProcedure.id === 'MIX') {
      if (selectedPieces.length !== 2) return;
      setUsedProcedure({ id: 'MIX', at: Date.now() });
      combineSelected(); return;
    }
    procedureRequest.current = true;
    setIsSynthesizing(true); setCombineError(null);
    const selected = [...selectedPieces];
    const inputs = selected.map(piece => foundryMaterials.find(material =>
      discoveryIdentity(material.displayName) === discoveryIdentity(piece.name)) || {
        ...conceptMaterial({ result: piece.name, emoji: piece.emoji }),
        customSpriteUrl: customSprites.get(discoveryIdentity(piece.name)),
      });
    setUsedProcedure({ id: activeProcedure.id, at: Date.now() });
    try {
      flushQueuedCraftSave();
      const result = await runSynthesis({ slotA: inputs[0], slotB: inputs[1] || null, selectedProcess: activeProcedure, inline: true });
      setElements(sanitizeElements(readCraftElements()));
      if (!result) { setCombineError(`${activeProcedure.name} could not finish. Your elements are unchanged. Try Apply again.`); return; }
      const name = result.craftResult?.name || result.material?.displayName || result.oddkin?.speciesName;
      if (!name) { setSpawnToast(result.explanation || 'No reaction this time. Try another procedure.'); return; }
      const saved = readCraftElements().find(element => discoveryIdentity(element.name) === discoveryIdentity(name));
      const item = result.craftResult || saved;
      const emoji = item?.emoji || '✨';
      if (item) setLastResult({ ...item, isNew: result.isNew });
      setCanvasItems(previous => [...previous.filter(tile => !selected.some(input => input.instanceId === tile.instanceId)), {
        instanceId: `procedure-${Date.now()}`, name, emoji, isShiny: item?.isShiny,
        x: selected[0].x, y: selected[0].y,
      }]);
      setSelectedCanvasId(null); setSecondSelectedCanvasId(null);
      setSpawnToast(`${activeProcedure.name}: ${name}. ${result.explanation}`);
    } catch (error) {
      setCombineError(error instanceof Error ? error.message : 'The procedure could not finish. Your elements are unchanged.');
    } finally { procedureRequest.current = false; setIsSynthesizing(false); }
  };

  return (
    <CraftSprites.Provider value={customSprites}>
    <div className="boop-craft-studio toybox-studio">
      <header className="toybox-intro">
        <h1>Let’s see what<br />happens.<img src="/toybox/curiosity-accent.png" alt="" aria-hidden="true" /></h1>
        <span className="toybox-eyebrow">CRAFT</span>
        <p>Pick elements. Mix them or apply a procedure.</p>
      </header>
      <div className="toybox-primary-actions">
      <button type="button" className="toybox-combine" disabled={isSynthesizing || foundryBusy || !selectedPieces.length || (activeProcedure?.id === 'MIX' && selectedPieces.length !== 2)}
        aria-label={activeProcedure?.id === 'MIX' && selectedPieces.length === 2 ? `Combine ${selectedPieces[0].name} + ${selectedPieces[1].name}` : undefined}
        onClick={() => void applyProcedure()}>{isSynthesizing ? 'Working…' : activeProcedure?.id === 'MIX'
          ? selectedPieces.length === 2 ? 'Combine selected' : 'Pick two elements to combine'
          : selectedPieces.length ? `Apply ${activeProcedure?.name}` : `Select an element to ${activeProcedure?.name.toLowerCase()}`}</button>

      </div>
      <div className="toybox-board-secondary">
        <button type="button" onClick={() => setActiveTab('arena')}>🏆 Arena</button>
        <button type="button" disabled={isSynthesizing || foundryBusy || !spawnPool.length || canvasItems.length > 298}
          onClick={() => spawnRandomBatch(2, undefined, true)}><Shuffle size={17}/>Random pair</button>
        <button type="button" disabled={isSynthesizing || foundryBusy || !canvasItems.length} onClick={tidyCanvas}><LayoutGrid size={17}/>Tidy board</button>
      </div>
      <BoardProcedures catalog={procedureCatalog} selected={activeProcedure?.id || 'MIX'} busy={isSynthesizing || foundryBusy}
        used={usedProcedure} onSelect={setProcedureId}/>
        {lastResult && <div className={`boop-board-result ${lastResult.isNew ? "boop-board-result-new" : "boop-board-result-repeat"} tier-${rarityInfo(lastResult.rarityTier).id}`} key={lastResult.discoveredAt} role="status">
          <div className="boop-board-roll-odds" title="Independent probabilities per successful combination; recipe discoveries do not have fixed odds">
            {rollOddsCaption(lastResult.rarityTier, Boolean(lastResult.isShiny), Boolean(lastResult.unlockedCelestial), Boolean(lastResult.unlockedHolo), Boolean(lastResult.unlockedGlitch))}
          </div>
          <CraftSprite name={lastResult.name} emoji={lastResult.emoji} isShiny={lastResult.isShiny}/>
          <div className="boop-result-info"><small>{lastResult.isNew ? '✦ NEW DISCOVERY' : 'CREATED'}</small><strong>{lastResult.name}</strong><RarityBadges item={lastResult} compact showProgress={false}/><ElementValueBadge element={lastResult} valueBook={valueBook}/></div>
          <button onClick={()=>spawnOnCanvas(lastResult.name,lastResult.emoji,Boolean(lastResult.isShiny))} aria-label="Add another copy to board" title="Add another copy"><Plus size={17}/></button>
          <button aria-label="Dismiss result" onClick={()=>setLastResult(null)}><X size={16}/></button>
        </div>}
      <section className="boop-board-layout" aria-label="Discover crafting board">
        <header className="boop-board-toolbar boop-board-toolbar--quiet">
          <div className="boop-board-heading sr-only"><strong>Craft</strong><small>Pick two elements, or drag one onto another.</small></div>
          <div className="boop-board-actions boop-board-actions--quiet">
            <button type="button" className="toybox-random" disabled={isSynthesizing || foundryBusy || !spawnPool.length || canvasItems.length >= 300}
              aria-label={`Spawn ${spawnCount} random ${spawnCount === 1 ? 'element' : 'elements'} from ${spawnPool.length} equally likely discoveries`}
              title={`Random adds ${spawnCount} elements. Change the amount and filters in More crafting tools.`}
              onClick={() => spawnRandomBatch(spawnCount)}><Shuffle size={18}/><span>Random</span></button>
            <details className="boop-board-more" aria-label="More crafting tools">
              <summary aria-label="More crafting tools" title="More crafting tools"><SlidersHorizontal size={19}/></summary>
              <div className="boop-board-more-panel">
                <span className="boop-board-more-label">SMART RANDOMIZER</span>
                <label className="boop-smart-field">Pick from
                  <select aria-label="Random spawn source" value={spawnSource} onChange={e=>setSpawnSource(e.target.value as SpawnSource)}>
                    <option value="all">All discoveries</option><option value="recent">Recent 40</option>
                    <option value="shiny">Shiny forms</option><option value="starters">Starter elements</option>
                  </select>
                </label>
                <label className="boop-smart-field">Category
                  <select aria-label="Random spawn category" value={spawnCategory} onChange={e=>setSpawnCategory(e.target.value)}>
                    <option value="all">All categories ({spawnCategories.reduce((sum,entry)=>sum+entry.count,0)})</option>{spawnCategories.map(entry=><option key={entry.name} value={entry.name}>{entry.name} ({entry.count})</option>)}
                  </select>
                </label>
                <label className="boop-smart-field">Minimum rarity
                  <select aria-label="Random spawn rarity" value={spawnRarity} onChange={e=>setSpawnRarity(e.target.value as SmartRarity)}>
                    <option value="all">Any rarity</option><option value="rare">Rare+</option>
                    <option value="epic">Epic+</option><option value="legendary">Legendary+</option>
                  </select>
                </label>
                <p className="boop-smart-odds" role="status">{spawnPool.length} eligible discoveries · {spawnPool.length?`1/${spawnPool.length} per first pick`:'No items match; adjust filters'}</p>
                <span className="boop-board-more-label">SPAWN AMOUNT</span>
                <div className="boop-board-more-counts" role="group" aria-label="Random spawn count">
                  {SPAWN_COUNTS.map(count=><button type="button" key={count} aria-pressed={spawnCount===count}
                    aria-label={`Select ${count} elements per spawn`} onClick={()=>setSpawnCount(count)}>{count}</button>)}
                </div>
                <button type="button" className="boop-suggest-pair" disabled={spawnPool.length === 0 || canvasItems.length > 298} onClick={() => {
                  const pair = chooseUndiscoveredPair(spawnPool, BUILT_IN_PAIR_RECIPES);
                  if (pair) spawnRandomBatch(2, pair);
                  else { spawnRandomBatch(2); setSpawnToast('No known undiscovered pair yet — added two random items.'); }
                }}><Sparkles size={16}/> Suggest a discovery <small>Two items from your collection</small></button>
                <button type="button" className="boop-suggest-pair" disabled={!spawnPool.length || canvasItems.length > 298}
                  onClick={()=>{
                    const pair=chooseUntriedPair(spawnPool,sharedElements);
                    if(pair)spawnRandomBatch(2,pair);
                    else setSpawnToast('No untried pair found in this filtered collection.');
                  }}><Sparkles size={16}/> Try an untried pair <small>Uses only owned elements; no AI call until you combine</small></button>
                <span className="boop-board-more-label">ADVANCED CRAFTING</span>
                <button type="button" className="boop-suggest-pair" onClick={()=>setAdvancedFusionOpen(true)}>
                  <Sparkles size={16}/> Advanced Fusion <small>3–4 items · known recipes · no AI cost</small>
                </button>
                {selectedPieces.length > 0 && <>
                  <span className="boop-board-more-label">SELECTED ELEMENT</span>
                  <small style={{overflowWrap:'anywhere'}}>{selectedPieces[0].name}</small>
                  <button type="button" onClick={event=>handleDuplicate(selectedPieces[0],event)}><Plus size={16}/>Duplicate selected element</button>
                  <button type="button" onClick={event=>handleRemoveFromCanvas(selectedPieces[0].instanceId,event)}><Trash2 size={16}/>Remove selected element</button>
                </>}
                <span className="boop-board-more-label">BOARD TOOLS</span>
                <div className="boop-board-more-actions">
                  <button type="button" aria-label="Redo board action" disabled={isSynthesizing||!historySize.future} onClick={redoLayout}><Redo2 size={16}/> Redo</button>
                  <button type="button" onClick={tidyCanvas}><LayoutGrid size={16}/> Tidy</button>
                  <button type="button" onClick={clearCanvas}><Trash2 size={16}/> Clear board</button>
                </div>
                <div className="boop-board-more-zoom">
                  <span>Zoom</span>
                  <button type="button" aria-label="Zoom out" disabled={boardZoom<=.6} onClick={()=>setZoomPreservingCenter(boardZoom-.15)}><Minus size={17}/></button>
                  <strong>{Math.round(boardZoom*100)}%</strong>
                  <button type="button" aria-label="Zoom in" disabled={boardZoom>=1.5} onClick={()=>setZoomPreservingCenter(boardZoom+.15)}><ZoomIn size={17}/></button>
                </div>
              </div>
            </details>
          </div>
        </header>
        <div className="boop-board-viewport" ref={viewportRef} aria-label="Pan and drag crafting board" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
          <div ref={canvasRef} className="boop-board-world" style={{ width:BOARD_WIDTH, height:Math.max(BOARD_HEIGHT, ...canvasItems.map(item => item.y + 320)), zoom:boardZoom }}>
            <div className="boop-board-origin-hint" style={{ left:BOARD_START_X - 6, top:BOARD_START_Y - 68 }}>DROP. MIX. DISCOVER.</div>
            {canvasItems.map(item => <CanvasBoardTile key={item.instanceId} item={item}
              label={meaningLabels.get(discoveryIdentity(item.name)) || item.name}
              category={motionCategories.get(discoveryIdentity(item.name))}
              spawnTileMaxWidth={spawnTileMaxWidth}
              selected={selectedCanvasId === item.instanceId || secondSelectedCanvasId === item.instanceId} onPointerDown={onBoardPointerDown}
              onClickItem={onBoardClick} onDuplicate={onBoardDuplicate} onRemove={onBoardRemove} />)}
            {mergeFx && <div key={mergeFx.id} className="boop-board-fusion" style={{left:mergeFx.x,top:mergeFx.y}} aria-hidden="true">
              <span className="boop-merge-piece boop-merge-a" style={{'--from-x':`${mergeFx.dxA}px`,'--from-y':`${mergeFx.dyA}px`} as React.CSSProperties}>{mergeFx.a}</span>
              <span className="boop-merge-piece boop-merge-b" style={{'--from-x':`${mergeFx.dxB}px`,'--from-y':`${mergeFx.dyB}px`} as React.CSSProperties}>{mergeFx.b}</span>
              <i/>
            </div>}
          </div>
        </div>
        {activeCombination && <div className="boop-board-status" role="status"><span className="boop-inline-spinner"/>Combining {activeCombination.nameA} + {activeCombination.nameB}… <small>Keep moving tiles</small></div>}
        {combineError && <div className="boop-board-alert" role="alert">{combineError}<button onClick={()=>{if(activeProcedure?.id !== 'MIX')void applyProcedure();else if(lastPairRef.current)void handleCombine(lastPairRef.current[0],lastPairRef.current[1]);}}>Retry</button><button onClick={()=>setCombineError(null)}>Dismiss</button></div>}
        <p className="sr-only" role="status">{activeProcedure?.id !== 'MIX'
          ? selectedPieces.length ? `${selectedPieces.map(piece => piece.name).join(' and ')} selected. Ready to ${activeProcedure?.name.toLowerCase()}.` : 'Select one or two elements for this procedure.'
          : selectedPieces.length === 2 ? `${selectedPieces[0].name} and ${selectedPieces[1].name} selected. Ready to combine.` : selectedPieces.length === 1 ? `${selectedPieces[0].name} selected. Pick one more element.` : 'Pick two elements to combine.'}</p>
        {spawnToast && <div className="boop-board-toast" role="status">{spawnToast}</div>}
        <div className="toybox-mat-tools">
          <button type="button" aria-label="Undo last board action" disabled={isSynthesizing || !historySize.past} onClick={undoLayout}><Undo2 size={19}/>Undo</button>
          <button type="button" disabled={isSynthesizing || !canvasItems.length} onClick={clearCanvas}><Trash2 size={19}/>Clear</button>
          <button type="button" onClick={()=>setIsSidebarOpen(true)} aria-label="Open element library"><Plus size={20}/>Add</button>
        </div>
        {isSidebarOpen && <div className="boop-board-drawer-backdrop" onClick={()=>setIsSidebarOpen(false)} aria-hidden="true"/>}
        <aside id="boop-board-library" className={`boop-board-drawer ${isSidebarOpen ? 'is-open' : ''}`} aria-label="Your element library" aria-hidden={!isSidebarOpen}>
          <div className="boop-board-drawer-head"><div><h2>Ingredients</h2><small>{elements.length} discovered · tap to add to board</small></div><button aria-label="Close ingredients" onClick={()=>setIsSidebarOpen(false)}><X size={21}/></button></div>
          <label className="boop-search"><Search size={17}/><input ref={searchInputRef} tabIndex={isSidebarOpen?0:-1} aria-label="Search ingredients" placeholder="Search elements…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} /></label>
          <div className="boop-library-filters"><div className="boop-pills">{(['all','new','shiny'] as const).map(filter=><button key={filter} tabIndex={isSidebarOpen?0:-1} aria-pressed={ingredientFilter===filter} onClick={()=>setIngredientFilter(filter)}>{filter==='all'?'All':filter==='new'?'First finds':'Shiny'}</button>)}</div>
            <select tabIndex={isSidebarOpen?0:-1} aria-label="Sort ingredients" value={sortMode} onChange={e=>setSortMode(e.target.value as typeof sortMode)}><option value="time">Recent</option><option value="alpha">A-Z</option><option value="crafted">Most crafted</option></select></div>
          <div className="boop-board-ingredient-grid">{isSidebarOpen && ingredientList.map(el=><div key={el.id} className="boop-board-library-item"><button disabled={!isSidebarOpen} onClick={()=>{spawnFromSidebar(el);setIsSidebarOpen(false);}}><CraftSprite name={el.name} emoji={el.emoji} category={el.category} isShiny={el.isShiny}/><span>{el.name}</span><Plus size={15}/></button><button disabled={!isSidebarOpen} aria-label={`Inspect ${el.name}`} onClick={()=>setInspectedElement(el)}><Info size={15}/></button></div>)}</div>
          {!ingredientList.length && <div className="boop-empty">No elements match this search.</div>}
          <div className="boop-board-drawer-footer"><span>{collectionStats.totalCrafts.toLocaleString()} crafts</span><span>{collectionStats.totalShinies} shinies</span><button onClick={()=>setActiveTab('profile')}>Profile stats →</button></div>
        </aside>
      </section>

      {firstDiscoveryModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setFirstDiscoveryModal(null)}><div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl text-center relative overflow-hidden ${isDarkMode ? 'bg-[#18181b] border-amber-500/40 text-white' : 'bg-white border-amber-400 text-black'}`}><div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" /><div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" /><div className="text-5xl mb-3 animate-bounce"><CraftSprite name={firstDiscoveryModal.name} emoji={firstDiscoveryModal.emoji} isShiny={firstDiscoveryModal.isShiny} /></div><div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-mono font-bold tracking-widest uppercase mb-2"><Sparkles className="w-3.5 h-3.5" />FIRST DISCOVERY!</div><h3 className="text-2xl font-black tracking-tight mb-1">{firstDiscoveryModal.name}</h3><p className="text-xs text-zinc-400 mb-5 leading-relaxed">You are the very first crafter to unlock this combination in the global matrix!</p>{firstDiscoveryModal.recipe && <div className={`p-3 rounded-xl border text-xs font-mono mb-5 ${isDarkMode ? 'bg-black/30 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'}`}>{firstDiscoveryModal.recipe.first} + {firstDiscoveryModal.recipe.second} = {firstDiscoveryModal.name}</div>}<button onClick={() => { sound.playClick(); setFirstDiscoveryModal(null); }} className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-lg transition-all active:scale-95">Continue Crafting</button></div></div>}

      {advancedFusionOpen&&<AdvancedFusionModal elements={sharedElements} busy={isSynthesizing||Boolean(requestRef.current)}
        onClose={()=>setAdvancedFusionOpen(false)} onFuse={fuseAdvanced}/>}
      {inspectedElement && <ElementDossierModal element={normalizeElementStats(inspectedElement)} valueBook={valueBook} onClose={() => setInspectedElement(null)} onSpawnOnCanvas={(name, emoji, isShiny) => spawnOnCanvas(name, emoji, isShiny)} isDarkMode={isDarkMode} />}
    </div>
    </CraftSprites.Provider>
  );
}

