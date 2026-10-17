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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  STARTER_ELEMENTS,
  InfiniteElement,
  InfiniteCraftPairResponse,
} from '../lib/infiniteCraftData';
import { requestJson } from '../lib/api';
import { saveCraftElements, readCraftElements, SAVE_IMPORTED_EVENT } from '../lib/saveData';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import { CombineAnimationOverlay, ActiveCombination } from './CombineAnimationOverlay';
import { CraftingCrucible, CrucibleSlotItem } from './CraftingCrucible';
import { ElementDossierModal } from './ElementDossierModal';
import { generateConceptSprite } from '../lib/pixelRenderer';
import { rollIsShiny, generatePhysicalData, getShinyFoilStyle } from '../lib/physicalDataEngine';
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
  Trophy,
} from 'lucide-react';

interface CanvasItem {
  instanceId: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  isNew?: boolean;
  isShiny?: boolean;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
}

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
  const [showFreeform, setShowFreeform] = useState(false);
  const [ingredientFilter, setIngredientFilter] = useState<'all' | 'new' | 'shiny'>('all');
  const [lastResult, setLastResult] = useState<InfiniteElement | null>(null);
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
      setCanvasItems([]);
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

  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([
    { instanceId: 'init-1', name: 'Water', emoji: '💧', x: 60, y: 100 },
    { instanceId: 'init-2', name: 'Fire', emoji: '🔥', x: 190, y: 100 },
    { instanceId: 'init-3', name: 'Wind', emoji: '💨', x: 60, y: 170 },
    { instanceId: 'init-4', name: 'Earth', emoji: '🌍', x: 190, y: 170 },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'time' | 'alpha' | 'discoveries' | 'shinies' | 'crafted'>('time');
  const isDarkMode = false;
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeCombination, setActiveCombination] = useState<ActiveCombination | null>(null);

  const [crucibleSlotA, setCrucibleSlotA] = useState<CrucibleSlotItem | null>(null);
  const [crucibleSlotB, setCrucibleSlotB] = useState<CrucibleSlotItem | null>(null);
  const [isCrucibleHovered, setIsCrucibleHovered] = useState(false);
  const crucibleRef = useRef<HTMLDivElement | null>(null);

  const [firstDiscoveryModal, setFirstDiscoveryModal] = useState<InfiniteElement | null>(null);
  const [inspectedElement, setInspectedElement] = useState<InfiniteElement | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [spawnToast, setSpawnToast] = useState<string | null>(null);

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
    isTouch: boolean;
    moved: boolean;
  } | null>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);

  useEffect(() => {
    try { saveCraftElements(sanitizeElements(elements)); }
    catch (e) { console.error('Failed to save infinite craft elements', e); }
  }, [elements]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      if (target?.matches('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === 'Escape') {
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
  }, [firstDiscoveryModal, inspectedElement, selectedCanvasId, isSidebarOpen]);

  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, alpha: p.alpha - 0.04, size: p.size * 0.96 })).filter(p => p.alpha > 0.05));
    }, 24);
    return () => clearInterval(interval);
  }, [particles.length]);

  const spawnParticles = (x: number, y: number, isGold = false) => {
    const colors = isGold ? ['#fbbf24', '#f59e0b', '#d97706', '#fef08a', '#ffffff'] : ['#60a5fa', '#93c5fd', '#38bdf8', '#c084fc', '#f472b6'];
    const newBatch: Particle[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5);
      const speed = Math.random() * 4 + 2;
      newBatch.push({ id: `part-${Date.now()}-${i}-${Math.random()}`, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() * 5 + 3, alpha: 1 });
    }
    setParticles(prev => [...prev.slice(-40), ...newBatch]);
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
    setIsSynthesizing(true);
    sound.playCombineChime();
    haptics.fusionPulse();

    const targetX = (itemA.x + itemB.x) / 2;
    const targetY = (itemA.y + itemB.y) / 2;
    setActiveCombination({ idA: itemA.idA || 'a', idB: itemB.idB || 'b', nameA: itemA.name, emojiA: itemA.emoji || '✨', x1: itemA.x, y1: itemA.y, nameB: itemB.name, emojiB: itemB.emoji || '✨', x2: itemB.x, y2: itemB.y, midX: targetX, midY: targetY });

    try {
      const apiPromise = requestJson<InfiniteCraftPairResponse>(`/api/infinite-craft/pair?first=${encodeURIComponent(itemA.name)}&second=${encodeURIComponent(itemB.name)}`, { signal: controller.signal });
      const [apiData] = await Promise.all([apiPromise, new Promise(r => setTimeout(r, 260))]);
      if (typeof apiData.result !== 'string' || !apiData.result.trim() || typeof apiData.emoji !== 'string' || typeof apiData.isNew !== 'boolean') throw new Error('The server returned an invalid combination. Please retry.');
      if (controller.signal.aborted) return;

      const isShinyEncounter = rollIsShiny(apiData.result, itemA.name, itemB.name);
      if (isShinyEncounter) setActiveCombination(prev => prev ? { ...prev, isShiny: true } : null);
      await new Promise(r => setTimeout(r, 80));
      if (controller.signal.aborted) return;

      const { result, emoji, isNew } = apiData;
      const cleanName = result.trim();
      const normName = cleanName.toLowerCase();
      const cleanId = normName.replace(/[^a-z0-9]/g, '_');
      const craftedAt = Date.now();
      const currentRecipe = { first: itemA.name, second: itemB.name };
      const standardPhysicalData = generatePhysicalData(cleanName, emoji || '✨', false);
      const shinyPhysicalData = isShinyEncounter ? generatePhysicalData(cleanName, emoji || '✨', true) : undefined;
      spawnParticles(targetX, targetY, isShinyEncounter || isNew);

      const newElemObj: InfiniteElement = {
        id: cleanId,
        name: cleanName,
        emoji: emoji || '✨',
        discoveredAt: craftedAt,
        isNew: Boolean(isNew),
        explanation: apiData.explanation,
        connection: apiData.connection,
        recipe: currentRecipe,
        isShiny: isShinyEncounter,
        unlockedShiny: isShinyEncounter,
        shinyDiscoveredAt: isShinyEncounter ? craftedAt : undefined,
        shinyTitle: shinyPhysicalData?.shinyTitle,
        physicalData: standardPhysicalData,
        ...initialCraftStats(currentRecipe, isShinyEncounter, craftedAt),
      };

      setLastResult(newElemObj);
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
            physicalData: existing.physicalData || standardPhysicalData,
          };
          return updated;
        }
        return [newElemObj, ...prev];
      });

      const bonus = apiData.bonus;
      if (bonus && typeof bonus.result === 'string' && bonus.result.trim() && bonus.result.length <= 160 && typeof bonus.emoji === 'string' && bonus.emoji.trim() && bonus.emoji.length <= 32 && bonus.variantOf === cleanName && typeof bonus.explanation === 'string' && bonus.explanation.length <= 280) {
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

      if (isShinyEncounter) {
        const foil = getShinyFoilStyle(cleanName);
        sound.playShiny();
        haptics.shinySparkle();
        if (!bonus) setSpawnToast(`✨ ${foil.name.toUpperCase()} SHINY ${cleanName.toUpperCase()}!`);
        setTimeout(() => setSpawnToast(null), 3000);
      } else if (isNew) {
        sound.playFirstDiscoveryChime();
        haptics.firstDiscovery();
        setFirstDiscoveryModal(newElemObj);
      } else {
        sound.playCraftPop();
        haptics.discovery();
      }

      setCanvasItems(prev => {
        const filtered = prev.filter(it => it.instanceId !== itemA.idA && it.instanceId !== itemB.idB);
        return [...filtered, { instanceId: `inst-${Date.now()}-${Math.random()}`, name: cleanName, emoji: emoji || '✨', x: Math.max(12, Math.min((canvasRef.current?.clientWidth || 400) - 160, targetX)), y: Math.max(12, Math.min((canvasRef.current?.clientHeight || 400) - 64, targetY)), isNew, isShiny: isShinyEncounter }];
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
      setHoverTargetId(null);
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
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const width = canvasBounds ? canvasBounds.width : 500;
    const height = canvasBounds ? canvasBounds.height : 400;
    const x = Math.max(30, width / 2 - 100 + (Math.random() * 140 - 70));
    const y = Math.max(30, height / 2 - 60 + (Math.random() * 120 - 60));
    const newItem: CanvasItem = { instanceId: `spawn-${Date.now()}-${Math.random()}`, name, emoji, x, y, isShiny };
    setCanvasItems(prev => [...prev, newItem]);
    setSpawnToast(`${emoji} ${isShiny ? '✨ ' : ''}${name} added`);
    setTimeout(() => setSpawnToast(null), 1800);
    if (selectedCanvasId) {
      const selected = canvasItems.find(it => it.instanceId === selectedCanvasId);
      if (selected) handleCombine({ name: selected.name, x: selected.x, y: selected.y, idA: selected.instanceId }, { name, x, y, idB: newItem.instanceId });
    }
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
    const startX = 40, startY = 70, itemWidth = 145, itemHeight = 52;
    const canvasWidth = canvasRef.current?.clientWidth || 600;
    const cols = Math.max(1, Math.floor((canvasWidth - 80) / itemWidth));
    setCanvasItems(prev => prev.map((item, idx) => ({ ...item, x: startX + (idx % cols) * itemWidth, y: startY + Math.floor(idx / cols) * itemHeight })));
  };

  const handlePointerDown = (item: CanvasItem, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const isTouch = e.pointerType === 'touch';
    const touchLift = isTouch ? 36 : 0;
    draggingItemRef.current = { instanceId: item.instanceId, offsetX: e.clientX - item.x, offsetY: e.clientY - item.y + touchLift, startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY, isTouch, moved: false };
    setActiveDragId(item.instanceId);
  };

  const interactions = useRef({ dropIntoCrucible, handleCombine });
  interactions.current = { dropIntoCrucible, handleCombine };
  useEffect(() => {
    const processDragFrame = () => {
      rafPendingRef.current = false;
      const drag = draggingItemRef.current;
      if (!drag) return;
      const newX = drag.currentX - drag.offsetX;
      const newY = drag.currentY - drag.offsetY;
      setCanvasItems(prev => prev.map(it => it.instanceId === drag.instanceId ? { ...it, x: newX, y: newY } : it));
      let overCrucible = false;
      if (crucibleRef.current) {
        const rect = crucibleRef.current.getBoundingClientRect();
        overCrucible = drag.currentX >= rect.left - 15 && drag.currentX <= rect.right + 15 && drag.currentY >= rect.top - 15 && drag.currentY <= rect.bottom + 15;
      }
      setIsCrucibleHovered(overCrucible);
      if (overCrucible) setHoverTargetId(null);
      else {
        let nearestId: string | null = null;
        const proximityThreshold = drag.isTouch ? 85 : 70;
        for (const other of canvasItemsRef.current) {
          if (other.instanceId === drag.instanceId) continue;
          if (Math.hypot(other.x - newX, other.y - newY) < proximityThreshold) { nearestId = other.instanceId; break; }
        }
        setHoverTargetId(prev => { if (nearestId && nearestId !== prev) haptics.proximityTick(); return nearestId; });
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const drag = draggingItemRef.current;
      if (!drag) return;
      drag.currentX = e.clientX; drag.currentY = e.clientY;
      if (!drag.moved) {
        if (Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY) >= 4) { drag.moved = true; haptics.lightTap(); }
        else return;
      }
      if (!rafPendingRef.current) { rafPendingRef.current = true; requestAnimationFrame(processDragFrame); }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const drag = draggingItemRef.current;
      if (!drag) return;
      const items = canvasItemsRef.current;
      const dragged = items.find(it => it.instanceId === drag.instanceId);
      if (dragged && drag.moved) {
        if (crucibleRef.current) {
          const rect = crucibleRef.current.getBoundingClientRect();
          if (e.clientX >= rect.left - 20 && e.clientX <= rect.right + 20 && e.clientY >= rect.top - 20 && e.clientY <= rect.bottom + 20) {
            haptics.mediumTap(); interactions.current.dropIntoCrucible(dragged); draggingItemRef.current = null; setActiveDragId(null); setHoverTargetId(null); setIsCrucibleHovered(false); return;
          }
        }
        const proximityThreshold = drag.isTouch ? 85 : 70;
        const targetItem = items.find(other => other.instanceId !== drag.instanceId && Math.hypot(other.x - dragged.x, other.y - dragged.y) < proximityThreshold);
        if (targetItem) { haptics.fusionPulse(); interactions.current.handleCombine({ name: dragged.name, emoji: dragged.emoji, x: dragged.x, y: dragged.y, idA: dragged.instanceId }, { name: targetItem.name, emoji: targetItem.emoji, x: targetItem.x, y: targetItem.y, idB: targetItem.instanceId }); }
      }
      draggingItemRef.current = null; setActiveDragId(null); setHoverTargetId(null); setIsCrucibleHovered(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', handlePointerUp); window.removeEventListener('pointercancel', handlePointerUp); };
  }, []);

  const clearCanvas = () => { sound.playClick(); haptics.heavyTap(); setCanvasItems([]); setSelectedCanvasId(null); };
  const customSprites = useMemo(() => new Map(elements.flatMap(el => {
    const sprite = el.customSpriteUrl;
    return sprite ? [[el.name.trim().toLowerCase(), sprite] as const] : [];
  })), [elements]);

  const selectIngredient = (element: InfiniteElement) => {
    if (isSynthesizing) return;
    sound.playClick(); haptics.lightTap();
    const slot = { name: element.name, emoji: element.emoji, isShiny: element.isShiny };
    if (!crucibleSlotA) setCrucibleSlotA(slot);
    else setCrucibleSlotB(slot);
  };
  const ingredientList = filteredElements.filter(el => ingredientFilter === 'all' || (ingredientFilter === 'new' ? el.isNew : el.unlockedShiny || el.isShiny));
  const recent = [...elements].filter(el => el.discoveredAt > 0).sort((a, b) => b.discoveredAt - a.discoveredAt).slice(0, 5);

  return (
    <CraftSprites.Provider value={customSprites}>
    <div className="boop-craft-studio">
      <section className="boop-craft-workspace">
        <div className="boop-screen-intro"><h1>What will you discover?</h1><p>Two familiar things. One unexpected result.</p></div>
        <div className="boop-craft-controls"><div className="boop-pills" aria-label="Crafting mode"><button aria-pressed="true">Classic craft</button><button aria-pressed="false" onClick={() => setActiveTab('foundry')}>Foundry</button></div>
          <button className="boop-text-button" disabled={isSynthesizing} onClick={() => {
            const pool = sanitizeElements(elements);
            if (!pool.length) return;
            const first = Math.floor(Math.random() * pool.length);
            const rest = pool.filter((_, index) => index !== first);
            setCrucibleSlotA(pool[first]); setCrucibleSlotB(rest[Math.floor(Math.random() * rest.length)] || pool[first]);
          }}><Shuffle size={18} /><span>Surprise me</span></button></div>
        <div ref={showFreeform ? undefined : canvasRef} className="boop-pad-stage" onDragOver={event => { if (!isSynthesizing) event.preventDefault(); }} onDrop={event => {
          event.preventDefault(); const name = event.dataTransfer.getData('application/x-boop-ingredient');
          const item = elements.find(el => el.name === name); if (item) selectIngredient(item);
        }}>
          <CraftingCrucible slotA={crucibleSlotA} slotB={crucibleSlotB} onClearSlotA={() => setCrucibleSlotA(null)} onClearSlotB={() => setCrucibleSlotB(null)} onClearAll={() => { setCrucibleSlotA(null); setCrucibleSlotB(null); }} onSwapSlots={handleSwapCrucible} onCombine={handleCrucibleCombine} isSynthesizing={isSynthesizing} isDarkMode={false} isDropTargetActive={isCrucibleHovered} crucibleRef={crucibleRef} />
          <CombineAnimationOverlay combination={activeCombination} isDarkMode={false} />
        </div>
        {combineError && <div role="alert" className="boop-error"><p>{combineError}</p><button onClick={() => { if (lastPairRef.current) void handleCombine(lastPairRef.current[0], lastPairRef.current[1]); }}>Retry combination</button><button onClick={() => setCombineError(null)}>Dismiss</button></div>}
        {lastResult && <div className="boop-result" role="status"><CraftSprite name={lastResult.name} emoji={lastResult.emoji} className="boop-result-sprite" /><div><small>ADDED TO YOUR COLLECTION</small><strong>{lastResult.name}</strong><p>{lastResult.explanation || 'Your next ingredient is ready.'}</p></div><button className="boop-secondary" disabled={isSynthesizing} onClick={() => selectIngredient(lastResult)}>Use it</button></div>}
        {spawnToast && <p className="boop-notice" role="status">{spawnToast}</p>}
        <div className="boop-section-heading"><h2>Recently discovered</h2><button className="boop-text-button" onClick={() => setActiveTab('archive')}>View collection ↗</button></div>
        <div className="boop-recent-grid">{(recent.length ? recent : elements.slice(0, 4)).map(el => <DiscoveryCard key={el.id} name={el.name} emoji={el.emoji} detail={el.isNew ? 'First discovery' : el.isShiny ? 'Shiny' : 'Discovery'} compact disabled={isSynthesizing} onSelect={() => selectIngredient(el)} onInspect={() => setInspectedElement(el)} />)}</div>
        <p className="boop-hint"><Sparkles size={18} />Try a place, an animal, or an idea. There’s always another combination.</p>
        <div className="boop-secondary-tools"><DiscoveryTrails elements={elements} busy={isSynthesizing} onPrepare={(a, b) => { setCrucibleSlotA(a); setCrucibleSlotB(b); }} />
          <button className="boop-secondary" aria-expanded={showFreeform} onClick={() => setShowFreeform(value => !value)}>{showFreeform ? 'Close freeform board' : 'Open freeform board'}</button></div>
        {showFreeform && <section className="boop-freeform"><div className="boop-section-heading"><h2>Freeform board</h2><button onClick={clearCanvas}>Clear</button><button onClick={tidyCanvas}>Tidy</button></div><p>Tap two items to combine, or drag one onto another.</p>
          <div ref={canvasRef} className="boop-freeform-canvas">{canvasItems.map(item => <div key={item.instanceId} className={`boop-board-item ${selectedCanvasId === item.instanceId ? 'is-selected' : ''}`} onPointerDown={e => handlePointerDown(item, e)} onClick={e => { e.stopPropagation(); handleCanvasItemClick(item); }} onDoubleClick={e => handleDuplicate(item, e)} style={{ transform: `translate3d(${item.x}px, ${item.y}px, 0)` }}><CraftSprite name={item.name} emoji={item.emoji} /><span>{item.name}</span><button aria-label={`Remove ${item.name} from board`} onClick={e => handleRemoveFromCanvas(item.instanceId, e)}><X size={14} /></button></div>)}</div>
        </section>}
      </section>
      <aside className="boop-ingredient-library" aria-label="Ingredient library">
        <div className="boop-section-heading"><h2>Your ingredients</h2><small>{elements.length} discoveries</small></div>
        <p className="boop-library-caption">Every discovery can become the next ingredient.</p>
        <label className="boop-search"><Search size={18} /><input ref={searchInputRef} aria-label="Find an ingredient" placeholder="Find an ingredient…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /><span className="boop-key-hint">/</span></label>
        <div className="boop-library-filters"><div className="boop-pills" aria-label="Filter ingredients">{(['all', 'new', 'shiny'] as const).map(filter => <button key={filter} aria-pressed={ingredientFilter === filter} onClick={() => setIngredientFilter(filter)}>{filter === 'all' ? 'All' : filter === 'new' ? 'First finds' : 'Shiny'}</button>)}</div>
          <select aria-label="Sort ingredients" value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)}><option value="time">Recent</option><option value="alpha">A–Z</option><option value="crafted">Most crafted</option></select></div>
        <div className="boop-ingredient-grid">{ingredientList.map(el => <DiscoveryCard key={el.id} name={el.name} emoji={el.emoji} detail={el.isShiny ? 'Shiny' : el.isNew ? 'First discovery' : `${el.craftCount || 0} crafts`} selected={crucibleSlotA?.name === el.name || crucibleSlotB?.name === el.name} disabled={isSynthesizing} onSelect={() => showFreeform ? spawnFromSidebar(el) : selectIngredient(el)} onInspect={() => setInspectedElement(el)} />)}</div>
        {!ingredientList.length && <div className="boop-empty"><Search size={24} /><h3>No matching discoveries</h3><p>Try a different name or filter.</p><button className="boop-secondary" onClick={() => { setSearchQuery(''); setIngredientFilter('all'); }}>Clear filters</button></div>}
        <button className="boop-secondary boop-explore" onClick={() => setActiveTab('archive')}>Explore your collection →</button>
        <div className="boop-hint boop-library-hint"><div><strong>A world of possibilities.</strong><p>Select two discoveries, or drag them into the pad. Your next favourite might be one mix away.</p></div></div>
        <div className="boop-mini-stats"><span><b>{collectionStats.totalCrafts}</b> crafts</span><span><b>{collectionStats.totalShinies}</b> shinies</span><span><b>{collectionStats.uniqueRecipes}</b> recipes</span></div>
      </aside>
      {firstDiscoveryModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setFirstDiscoveryModal(null)}><div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl text-center relative overflow-hidden ${isDarkMode ? 'bg-[#18181b] border-amber-500/40 text-white' : 'bg-white border-amber-400 text-black'}`}><div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" /><div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" /><div className="text-5xl mb-3 animate-bounce"><CraftSprite name={firstDiscoveryModal.name} emoji={firstDiscoveryModal.emoji} /></div><div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-mono font-bold tracking-widest uppercase mb-2"><Sparkles className="w-3.5 h-3.5" />FIRST DISCOVERY!</div><h3 className="text-2xl font-black tracking-tight mb-1">{firstDiscoveryModal.name}</h3><p className="text-xs text-zinc-400 mb-5 leading-relaxed">You are the very first crafter to unlock this combination in the global matrix!</p>{firstDiscoveryModal.recipe && <div className={`p-3 rounded-xl border text-xs font-mono mb-5 ${isDarkMode ? 'bg-black/30 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'}`}>{firstDiscoveryModal.recipe.first} + {firstDiscoveryModal.recipe.second} = {firstDiscoveryModal.name}</div>}<button onClick={() => { sound.playClick(); setFirstDiscoveryModal(null); }} className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-lg transition-all active:scale-95">Continue Crafting</button></div></div>}

      {inspectedElement && <ElementDossierModal element={normalizeElementStats(inspectedElement)} onClose={() => setInspectedElement(null)} onSpawnOnCanvas={(name, emoji, isShiny) => spawnOnCanvas(name, emoji, isShiny)} isDarkMode={isDarkMode} />}
    </div>
    </CraftSprites.Provider>
  );
}

