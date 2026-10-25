import { useGame } from '../lib/gameStore';
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
  InfiniteCraftPairResponse,
  validNewElementName,
} from '../lib/infiniteCraftData';
import { requestJson } from '../lib/api';
import { enqueueArtwork, startArtworkQueue } from '../lib/artworkQueue';
import { beginBoardHistory, recordBoardHistory, undoBoard, redoBoard, clampBoardZoom } from '../lib/boardHistory';
import { CANONICAL_INFINITE_CRAFT_RECIPES, makePairKey } from '../lib/infiniteCraftData';
import { findCraftDropTarget } from '../lib/craftCollision';
import { BOARD_WIDTH, BOARD_HEIGHT, BOARD_START_X, BOARD_START_Y, boardCenter, clampBoardTile } from '../lib/boardGeometry';
import { loadBoardLayout, saveBoardLayout } from '../lib/boardLayout';
import { spawnSourcePool, chooseSpawnElements, spawnPositions, spreadSpawnPositions, SPAWN_COUNTS, type SpawnCount } from '../lib/randomSpawn';
import { saveCraftElements, readCraftElements, SAVE_IMPORTED_EVENT } from '../lib/saveData';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import type { ActiveCombination } from './CombineAnimationOverlay';
import { CraftingCrucible, CrucibleSlotItem } from './CraftingCrucible';
import { ElementDossierModal } from './ElementDossierModal';
import { generateConceptSprite } from '../lib/pixelRenderer';
import { rollIsShiny, generatePhysicalData, getShinyFoilStyle } from '../lib/physicalDataEngine';
import { rollCelestial } from '../lib/collectorData';
import {
  normalizeElementStats,
  initialCraftStats,
  recordElementCraft,
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
    const normName = cleanName.toLowerCase();
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
    const starterNorm = starter.name.trim().toLowerCase();
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
  const { setActiveTab } = useGame();
  const showFreeform = true;
  const [ingredientFilter, setIngredientFilter] = useState<'all' | 'new' | 'shiny'>('all');
  const [lastResult, setLastResult] = useState<InfiniteElement | null>(null);
  // Sprite generation stays active without rerendering the Craft board for
  // every queue status update or showing a floating artwork progress box.
  useEffect(() => startArtworkQueue(), []);
  const [elements, setElements] = useState<InfiniteElement[]>(() => {
    try {
      const saved = JSON.stringify(readCraftElements());
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeElements(parsed);
      }
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
      setCombineError(null);
      lastPairRef.current = null;
    };
    window.addEventListener(SAVE_IMPORTED_EVENT, reload);
    return () => window.removeEventListener(SAVE_IMPORTED_EVENT, reload);
  }, []);

  useEffect(() => {
    const update = () => setElements(sanitizeElements(readCraftElements()));
    window.addEventListener(PROFILE_SPRITES_UPDATED, update);
    return () => window.removeEventListener(PROFILE_SPRITES_UPDATED, update);
  }, []);

  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(() => loadBoardLayout(readCraftElements()) ?? [
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
    if (requestRef.current) return;
    const next=undoBoard(historyRef.current);
    if(next===historyRef.current)return;
    historyRef.current=next;skipHistoryRef.current=true;setCanvasItems(next.present);haptics.lightTap();
  };
  const redoLayout = () => {
    if (requestRef.current) return;
    const next=redoBoard(historyRef.current);
    if(next===historyRef.current)return;
    historyRef.current=next;skipHistoryRef.current=true;setCanvasItems(next.present);haptics.lightTap();
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
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeCombination, setActiveCombination] = useState<ActiveCombination | null>(null);

  const [crucibleSlotA, setCrucibleSlotA] = useState<CrucibleSlotItem | null>(null);
  const [crucibleSlotB, setCrucibleSlotB] = useState<CrucibleSlotItem | null>(null);
  const [randomVersion, setRandomVersion] = useState(0);
  const [spawnCount, setSpawnCount] = useState<SpawnCount>(2);
  const spawnSequenceRef = useRef(0);
  const [isCrucibleHovered, setIsCrucibleHovered] = useState(false);
  const crucibleRef = useRef<HTMLDivElement | null>(null);

  const [firstDiscoveryModal, setFirstDiscoveryModal] = useState<InfiniteElement | null>(null);
  const [inspectedElement, setInspectedElement] = useState<InfiniteElement | null>(null);
  const [revealBurst, setRevealBurst] = useState<{ id: number; isRare: boolean } | null>(null);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
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
  const [mergeFx, setMergeFx] = useState<{ id: number; x: number; y: number; dxA: number; dyA: number; dxB: number; dyB: number; a: string; b: string } | null>(null);
  const mergeFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = BOARD_START_X * zoomRef.current - Math.min(220, viewport.clientWidth / 4);
    viewport.scrollTop = BOARD_START_Y * zoomRef.current - Math.min(160, viewport.clientHeight / 3);
  }, []);
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
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const draggingItemRef = useRef<{
    instanceId: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    originX: number;
    originY: number;
    pointerId: number;
    node: HTMLDivElement;
    startRect: DOMRect;
    targets: Array<{ item: HTMLDivElement; rect: DOMRect }>;
    moved: boolean;
  } | null>(null);
  const hoveredNodeRef = useRef<HTMLDivElement | null>(null);
  const suppressCanvasClickRef = useRef(false);

  useEffect(() => {
    try { saveCraftElements(sanitizeElements(elements)); }
    catch (e) { console.error('Failed to save infinite craft elements', e); }
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
        else if (selectedCanvasId) setSelectedCanvasId(null);
        else if (isSidebarOpen && window.innerWidth < 1024) setIsSidebarOpen(false);
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        setIsSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [firstDiscoveryModal, inspectedElement, selectedCanvasId, isSidebarOpen, isSynthesizing]);

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

  const filteredElements = useMemo(() => {
    let list = sanitizeElements(elements);
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
  }, [elements, searchQuery, sortMode]);

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
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    lastPairRef.current = [itemA, itemB];
    setCombineError(null);
    const localRecipe = CANONICAL_INFINITE_CRAFT_RECIPES[makePairKey(itemA.name, itemB.name)];
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
      // Known combinations never need the network. All others use the server's
      // persistent cache before the AI fallback, without an artificial delay.
      const apiData: InfiniteCraftPairResponse = localRecipe
        ? { ...localRecipe, isNew: false }
        : await requestJson<InfiniteCraftPairResponse>(
          `/api/infinite-craft/pair?first=${encodeURIComponent(itemA.name)}&second=${encodeURIComponent(itemB.name)}`,
          { signal: controller.signal },
        );
      if (typeof apiData.result !== 'string' || !validNewElementName(apiData.result) || typeof apiData.emoji !== 'string' || typeof apiData.isNew !== 'boolean') throw new Error('The AI produced an invalid or overlong element name. Please retry.');
      if (controller.signal.aborted) return;

      const isShinyEncounter = rollIsShiny(apiData.result, itemA.name, itemB.name);
      const isCelestialEncounter = rollCelestial();
      if (isShinyEncounter) setActiveCombination(prev => prev ? { ...prev, isShiny: true } : null);
      if (controller.signal.aborted) return;

      const { result, emoji, isNew } = apiData;
      const cleanName = result.trim();
      const normName = cleanName.toLowerCase();
      // Request artwork only for a discovery newly added to this player's collection,
      // not whenever a library grid happens to render a saved item.
      const firstInCollection = !elements.some(el => el.name.trim().toLowerCase() === normName);
      const cleanId = normName.replace(/[^a-z0-9]/g, '_');
      const craftedAt = Date.now();
      const currentRecipe = { first: itemA.name, second: itemB.name };
      const standardPhysicalData = generatePhysicalData(cleanName, emoji || '✨', false);
      const shinyPhysicalData = isShinyEncounter ? generatePhysicalData(cleanName, emoji || '✨', true) : undefined;
      spawnRevealBurst(isShinyEncounter || firstInCollection);

      const newElemObj: InfiniteElement = {
        id: cleanId,
        name: cleanName,
        emoji: emoji || '✨',
        discoveredAt: craftedAt,
        isNew: firstInCollection,
        explanation: apiData.explanation,
        connection: apiData.connection,
        recipe: currentRecipe,
        isShiny: isShinyEncounter,
        unlockedShiny: isShinyEncounter,
        shinyDiscoveredAt: isShinyEncounter ? craftedAt : undefined,
        shinyTitle: shinyPhysicalData?.shinyTitle,
        unlockedCelestial: isCelestialEncounter,
        celestialDiscoveredAt: isCelestialEncounter ? craftedAt : undefined,
        physicalData: standardPhysicalData,
        ...initialCraftStats(currentRecipe, isShinyEncounter, craftedAt),
      };

      setLastResult(newElemObj);
      // Artwork is best effort and never blocks discovery saves or the board.
      // Provider outages pause the durable queue instead of showing one error
      // after every newly discovered element.
      if (firstInCollection) enqueueArtwork(cleanName, false);
      if (isShinyEncounter) enqueueArtwork(cleanName, true);
      setElements(prev => {
        const existingIdx = prev.findIndex(el => el.id.toLowerCase() === cleanId || el.name.trim().toLowerCase() === normName);
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const tracked = recordElementCraft(existing, currentRecipe, isShinyEncounter, craftedAt);
          const updated = [...prev];
          updated[existingIdx] = {
            ...tracked,
            explanation: existing.explanation || apiData.explanation,
            connection: existing.connection || apiData.connection,
            recipe: existing.recipe || currentRecipe,
            unlockedShiny: isShinyEncounter || existing.unlockedShiny,
            isShiny: isShinyEncounter ? true : existing.isShiny,
            shinyDiscoveredAt: existing.shinyDiscoveredAt || (isShinyEncounter ? craftedAt : undefined),
            shinyTitle: existing.shinyTitle || shinyPhysicalData?.shinyTitle,
            unlockedCelestial: Boolean(existing.unlockedCelestial || isCelestialEncounter),
            celestialDiscoveredAt: existing.celestialDiscoveredAt || (isCelestialEncounter ? craftedAt : undefined),
            physicalData: existing.physicalData || standardPhysicalData,
          };
          return updated;
        }
        return [newElemObj, ...prev];
      });

      const bonus = apiData.bonus;
      if (bonus && typeof bonus.result === 'string' && validNewElementName(bonus.result) && typeof bonus.emoji === 'string' && bonus.emoji.trim() && bonus.emoji.length <= 32 && bonus.variantOf === cleanName && typeof bonus.explanation === 'string' && bonus.explanation.length <= 280) {
        const bonusAt = Date.now();
        const bonusRecipe = { first: itemA.name, second: itemB.name };
        const bonusElement: InfiniteElement = {
          id: bonus.result.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: bonus.result,
          emoji: bonus.emoji,
          variantOf: bonus.variantOf,
          explanation: bonus.explanation,
          connection: 'rare variant',
          recipe: bonusRecipe,
          discoveredAt: bonusAt,
          physicalData: generatePhysicalData(bonus.result, bonus.emoji, false),
          ...initialCraftStats(bonusRecipe, false, bonusAt),
        };
        setElements(prev => prev.some(e => e.name.toLowerCase() === bonus.result.toLowerCase()) ? prev : [bonusElement, ...prev]);
        setSpawnToast(`✦ Rare bonus: ${bonus.result}! ${cleanName} was also saved.`);
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
      } else if (firstInCollection) {
        sound.playFirstDiscoveryChime();
        haptics.firstDiscovery();
        setSpawnToast(`✦ New discovery: ${cleanName}`);
        setTimeout(() => setSpawnToast(null), 2200);
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
      if (hoveredNodeRef.current) hoveredNodeRef.current.classList.remove('is-drop-target');
      hoveredNodeRef.current = null;
      setIsCrucibleHovered(false);
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
    if (suppressCanvasClickRef.current || requestRef.current) return;
    sound.playClick(); haptics.lightTap();
    if (!selectedCanvasId) setSelectedCanvasId(item.instanceId);
    else if (selectedCanvasId === item.instanceId) setSelectedCanvasId(null);
    else {
      const firstItem = canvasItems.find(it => it.instanceId === selectedCanvasId);
      if (firstItem) { haptics.fusionPulse(); handleCombine({ name: firstItem.name, x: firstItem.x, y: firstItem.y, idA: firstItem.instanceId }, { name: item.name, x: item.x, y: item.y, idB: item.instanceId }); }
    }
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
    const viewport = viewportRef.current;
    const center = viewport ? boardCenter(viewport.scrollLeft/zoomRef.current, viewport.scrollTop/zoomRef.current, viewport.clientWidth/zoomRef.current, viewport.clientHeight/zoomRef.current) : { x: BOARD_START_X, y: BOARD_START_Y };
    const {x,y} = clampBoardTile(center.x - 65 + (Math.random() * 120 - 60), center.y - 22 + (Math.random() * 95 - 48));
    const newItem: CanvasItem = { instanceId: `spawn-${Date.now()}-${Math.random()}`, name, emoji, x, y, isShiny };
    setCanvasItems(prev => [...prev, newItem]);
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
    sound.playClick();
    if (canvasItems.length === 0) return;
    const startX = BOARD_START_X - 40, startY = BOARD_START_Y - 35, itemWidth = 154, itemHeight = 66;
    const cols = 5;
    setCanvasItems(prev => prev.map((item, idx) => ({ ...item, x: startX + (idx % cols) * itemWidth, y: startY + Math.floor(idx / cols) * itemHeight })));
  };

  const handlePointerDown = (item: CanvasItem, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    sound.unlock();
    suppressCanvasClickRef.current = false;
    draggingItemRef.current = {
      instanceId: item.instanceId,
      startX: e.clientX, startY: e.clientY,
      currentX: e.clientX, currentY: e.clientY,
      originX: item.x, originY: item.y,
      pointerId: e.pointerId, node: e.currentTarget,
      startRect: e.currentTarget.getBoundingClientRect(),
      targets: (Array.from(canvasRef.current?.querySelectorAll('[data-craft-instance]') || []) as HTMLDivElement[])
        .filter(node => node !== e.currentTarget)
        .map(node => ({ item: node, rect: node.getBoundingClientRect() })),
      moved: false,
    };
    setActiveDragId(item.instanceId);
  };

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
      return findCraftDropTarget<HTMLDivElement>(moving, drag.targets, { x: drag.currentX, y: drag.currentY });
    };
    const processDragFrame = () => {
      rafPendingRef.current = false;
      const drag = draggingItemRef.current;
      if (!drag || !drag.moved) return;
      applyDragPosition(drag);
      const target = hitTarget(drag);
      if (hoveredNodeRef.current !== target) {
        hoveredNodeRef.current?.classList.remove('is-drop-target');
        if (target) target.classList.add('is-drop-target');
        hoveredNodeRef.current = target;
      }
      const rect = crucibleRef.current?.getBoundingClientRect();
      const over = Boolean(rect && drag.currentX >= rect.left && drag.currentX <= rect.right
        && drag.currentY >= rect.top && drag.currentY <= rect.bottom);
      setIsCrucibleHovered(prev => prev === over ? prev : over);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const drag = draggingItemRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      drag.currentX = e.clientX;
      drag.currentY = e.clientY;
      if (!drag.moved) {
        if (Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY) < 5) return;
        drag.moved = true;
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
      setActiveDragId(null);
      hoveredNodeRef.current?.classList.remove('is-drop-target');
      hoveredNodeRef.current = null;
      setIsCrucibleHovered(false);
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

  const clearCanvas = () => { sound.playClick(); haptics.heavyTap(); setCanvasItems([]); setSelectedCanvasId(null); };
  const customSprites = useMemo(() => new Map(elements.flatMap(el => {
    const sprite = el.customSpriteUrl;
    return sprite ? [[el.name.trim().toLowerCase(), sprite] as const] : [];
  })), [elements]);

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

  // One familiar random pool; no slow AI calls or category picker.
  const spawnPool = useMemo(() => spawnSourcePool(elements, 'all'), [elements]);

  const spawnRandomBatch = (count: SpawnCount) => {
    setSpawnCount(count);
    if (!spawnPool.length) {
      setSpawnToast('Discover an element first.');
      return;
    }
    const remaining = Math.max(0, 300 - canvasItemsRef.current.length);
    if (!remaining) {
      setSpawnToast('Board is full. Clear or remove tiles to spawn more.');
      return;
    }
    const picked = chooseSpawnElements<InfiniteElement>(spawnPool, count).slice(0, remaining);
    const vp = viewportRef.current;
    const baseSpots = spawnPositions(picked.length,vp ? {
      scrollLeft:vp.scrollLeft/zoomRef.current,scrollTop:vp.scrollTop/zoomRef.current,
      clientWidth:vp.clientWidth/zoomRef.current,clientHeight:vp.clientHeight/zoomRef.current
    }:null);
    const batchId = ++spawnSequenceRef.current;
    // Repeated taps spread new pills around those already visible rather than
    // stacking an identical batch right on top of its predecessor.
    const spots = spreadSpawnPositions(baseSpots,canvasItemsRef.current,batchId);
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
    if (picked.length < count) setSpawnToast(`✦ +${picked.length} elements · Board full`);
    else setSpawnToast(`✦ +${picked.length} random ${picked.length===1?'element':'elements'}`);
    setRandomVersion(version => version + 1);
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

  return (
    <CraftSprites.Provider value={customSprites}>
    <div className="boop-craft-studio">
      <section className="boop-board-layout" aria-label="Discover crafting board">
        <header className="boop-board-toolbar boop-board-toolbar--quiet">
          <div className="boop-board-heading"><strong>Craft</strong><small>Drag elements together to discover</small></div>
          <div className="boop-board-actions boop-board-actions--quiet">
            <button type="button" className="boop-quiet-spawn" disabled={!spawnPool.length || canvasItems.length>=300}
              aria-label={`Spawn ${spawnCount} random ${spawnCount===1?'element':'elements'}`}
              onClick={()=>spawnRandomBatch(spawnCount)}>
              <Shuffle size={18}/><span>Spawn</span>
            </button>
            <button type="button" aria-label="Undo last board action" title="Undo" disabled={isSynthesizing || !historySize.past} onClick={undoLayout}><Undo2 size={19}/></button>
            <button type="button" className="boop-board-library-toggle" aria-expanded={isSidebarOpen} aria-controls="boop-board-library"
              aria-label="Open element library" onClick={()=>setIsSidebarOpen(v=>!v)}><Search size={19}/><span>Elements</span></button>
            <details className="boop-board-more" aria-label="More crafting tools">
              <summary aria-label="More crafting tools" title="More crafting tools"><SlidersHorizontal size={19}/></summary>
              <div className="boop-board-more-panel">
                <span className="boop-board-more-label">SPAWN AMOUNT</span>
                <div className="boop-board-more-counts" role="group" aria-label="Random spawn count">
                  {SPAWN_COUNTS.map(count=><button type="button" key={count} aria-pressed={spawnCount===count}
                    aria-label={`Select ${count} elements per spawn`} onClick={()=>setSpawnCount(count)}>{count}</button>)}
                </div>
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
          <div ref={canvasRef} className="boop-board-world" style={{ width:BOARD_WIDTH, height:BOARD_HEIGHT, zoom:boardZoom }}>
            <div className="boop-board-origin-hint" style={{ left:BOARD_START_X - 6, top:BOARD_START_Y - 68 }}>DROP. MIX. DISCOVER.</div>
            {canvasItems.map(item=><div
              key={item.instanceId} data-craft-instance={item.instanceId}
              className={`boop-board-item ${selectedCanvasId === item.instanceId ? 'is-selected' : ''} ${activeDragId === item.instanceId ? 'is-dragging' : ''} ${item.instanceId.startsWith('fusion-') ? 'is-fusion-result' : ''} ${item.instanceId.startsWith('spawn-') ? 'is-random-spawn' : ''}`}
              onPointerDown={e=>handlePointerDown(item,e)}
              onClick={e=>{e.stopPropagation();handleCanvasItemClick(item);}}
              onDoubleClick={e=>handleDuplicate(item,e)}
              style={{transform:`translate3d(${item.x}px,${item.y}px,0)`, '--spawn-delay':`${item.spawnDelay||0}ms`} as React.CSSProperties}>
              <CraftSprite name={item.name} emoji={item.emoji} isShiny={item.isShiny}/>
              <span>{item.name}</span>
              <button aria-label={`Duplicate ${item.name}`} title="Duplicate" className="boop-tile-duplicate" onClick={e=>handleDuplicate(item,e)}><Plus size={12}/></button>
              <button aria-label={`Remove ${item.name} from board`} title="Remove" onClick={e=>handleRemoveFromCanvas(item.instanceId,e)}><X size={12}/></button>
            </div>)}
            {mergeFx && <div key={mergeFx.id} className="boop-board-fusion" style={{left:mergeFx.x,top:mergeFx.y}} aria-hidden="true">
              <span className="boop-merge-piece boop-merge-a" style={{'--from-x':`${mergeFx.dxA}px`,'--from-y':`${mergeFx.dyA}px`} as React.CSSProperties}>{mergeFx.a}</span>
              <span className="boop-merge-piece boop-merge-b" style={{'--from-x':`${mergeFx.dxB}px`,'--from-y':`${mergeFx.dyB}px`} as React.CSSProperties}>{mergeFx.b}</span>
              <i/>
            </div>}
          </div>
        </div>
        {activeCombination && <div className="boop-board-status" role="status"><span className="boop-inline-spinner"/>Combining {activeCombination.nameA} + {activeCombination.nameB}… <small>Keep moving tiles</small></div>}
        {lastResult && <div className="boop-board-result" key={lastResult.discoveredAt} role="status"><CraftSprite name={lastResult.name} emoji={lastResult.emoji} isShiny={lastResult.isShiny}/><div><small>{lastResult.isNew ? '✦ NEW DISCOVERY' : 'CREATED'}</small><strong>{lastResult.name}</strong></div><button onClick={()=>spawnOnCanvas(lastResult.name,lastResult.emoji,Boolean(lastResult.isShiny))}>Add to board <Plus size={15}/></button><button aria-label="Dismiss result" onClick={()=>setLastResult(null)}><X size={16}/></button></div>}
        {combineError && <div className="boop-board-alert" role="alert">{combineError}<button onClick={()=>{if(lastPairRef.current)void handleCombine(lastPairRef.current[0],lastPairRef.current[1]);}}>Retry</button><button onClick={()=>setCombineError(null)}>Dismiss</button></div>}
        {spawnToast && <div className="boop-board-toast" role="status">{spawnToast}</div>}
        <button className="boop-board-mobile-library" onClick={()=>setIsSidebarOpen(true)} aria-label="Open element library"><Plus size={21}/> Add an element</button>
        {isSidebarOpen && <div className="boop-board-drawer-backdrop" onClick={()=>setIsSidebarOpen(false)} aria-hidden="true"/>}
        <aside id="boop-board-library" className={`boop-board-drawer ${isSidebarOpen ? 'is-open' : ''}`} aria-label="Your element library" aria-hidden={!isSidebarOpen}>
          <div className="boop-board-drawer-head"><div><h2>Ingredients</h2><small>{elements.length} discovered · tap to add to board</small></div><button aria-label="Close ingredients" onClick={()=>setIsSidebarOpen(false)}><X size={21}/></button></div>
          <label className="boop-search"><Search size={17}/><input ref={searchInputRef} tabIndex={isSidebarOpen?0:-1} aria-label="Search ingredients" placeholder="Search elements…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} /></label>
          <div className="boop-library-filters"><div className="boop-pills">{(['all','new','shiny'] as const).map(filter=><button key={filter} tabIndex={isSidebarOpen?0:-1} aria-pressed={ingredientFilter===filter} onClick={()=>setIngredientFilter(filter)}>{filter==='all'?'All':filter==='new'?'First finds':'Shiny'}</button>)}</div>
            <select tabIndex={isSidebarOpen?0:-1} aria-label="Sort ingredients" value={sortMode} onChange={e=>setSortMode(e.target.value as typeof sortMode)}><option value="time">Recent</option><option value="alpha">A-Z</option><option value="crafted">Most crafted</option></select></div>
          <div className="boop-board-ingredient-grid">{isSidebarOpen && ingredientList.map(el=><div key={el.id} className="boop-board-library-item"><button disabled={!isSidebarOpen} onClick={()=>{spawnFromSidebar(el);setIsSidebarOpen(false);}}><CraftSprite name={el.name} emoji={el.emoji} isShiny={el.isShiny}/><span>{el.name}</span><Plus size={15}/></button><button disabled={!isSidebarOpen} aria-label={`Inspect ${el.name}`} onClick={()=>setInspectedElement(el)}><Info size={15}/></button></div>)}</div>
          {!ingredientList.length && <div className="boop-empty">No elements match this search.</div>}
          <div className="boop-board-drawer-footer"><span>{collectionStats.totalCrafts.toLocaleString()} crafts</span><span>{collectionStats.totalShinies} shinies</span><button onClick={()=>setActiveTab('profile')}>Profile stats →</button></div>
        </aside>
      </section>
      {firstDiscoveryModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setFirstDiscoveryModal(null)}><div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl text-center relative overflow-hidden ${isDarkMode ? 'bg-[#18181b] border-amber-500/40 text-white' : 'bg-white border-amber-400 text-black'}`}><div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" /><div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" /><div className="text-5xl mb-3 animate-bounce"><CraftSprite name={firstDiscoveryModal.name} emoji={firstDiscoveryModal.emoji} isShiny={firstDiscoveryModal.isShiny} /></div><div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-mono font-bold tracking-widest uppercase mb-2"><Sparkles className="w-3.5 h-3.5" />FIRST DISCOVERY!</div><h3 className="text-2xl font-black tracking-tight mb-1">{firstDiscoveryModal.name}</h3><p className="text-xs text-zinc-400 mb-5 leading-relaxed">You are the very first crafter to unlock this combination in the global matrix!</p>{firstDiscoveryModal.recipe && <div className={`p-3 rounded-xl border text-xs font-mono mb-5 ${isDarkMode ? 'bg-black/30 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'}`}>{firstDiscoveryModal.recipe.first} + {firstDiscoveryModal.recipe.second} = {firstDiscoveryModal.name}</div>}<button onClick={() => { sound.playClick(); setFirstDiscoveryModal(null); }} className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-lg transition-all active:scale-95">Continue Crafting</button></div></div>}

      {inspectedElement && <ElementDossierModal element={normalizeElementStats(inspectedElement)} onClose={() => setInspectedElement(null)} onSpawnOnCanvas={(name, emoji, isShiny) => spawnOnCanvas(name, emoji, isShiny)} isDarkMode={isDarkMode} />}
    </div>
    </CraftSprites.Provider>
  );
}

