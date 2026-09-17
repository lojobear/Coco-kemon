import { DiscoveryTrails } from './DiscoveryTrails';
/**
 * INFINITE CRAFT (by Neal Agarwal) - High-Tactile Interactive Web View
 * Freeform canvas, draggable element pills, search sidebar, instant 0ms canonical pairings,
 * Gemini 3.1 Flash-Lite AI LLM generation, First Discovery celebrations, and recipe history.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  STARTER_ELEMENTS,
  InfiniteElement,
  InfiniteCraftPairResponse,
  makePairKey,
} from '../lib/infiniteCraftData';
import { requestJson } from '../lib/api';
import { saveCraftElements, readCraftElements, SAVE_IMPORTED_EVENT } from '../lib/saveData';
import { sound } from '../lib/audio';
import { haptics } from '../lib/haptics';
import { CombineAnimationOverlay, ActiveCombination } from './CombineAnimationOverlay';
import { CraftingCrucible, CrucibleSlotItem } from './CraftingCrucible';
import { ElementDossierModal } from './ElementDossierModal';
import { rollIsShiny, generatePhysicalData } from '../lib/physicalDataEngine';
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
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
  Shuffle,
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

const STORAGE_ELEMENTS_KEY = 'neal_infinite_craft_elements_v1';
const STORAGE_THEME_KEY = 'neal_infinite_craft_theme';

/**
 * Deduplicate and normalize an element list, ensuring unique IDs and names.
 */
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
      result.push({
        ...item,
        id: cleanId,
        name: cleanName,
        emoji: item.emoji || '✨',
      });
    }
  }

  // Ensure 4 primordial starter elements always exist
  for (const starter of STARTER_ELEMENTS) {
    const starterNorm = starter.name.trim().toLowerCase();
    const starterCleanId = starter.id.toLowerCase();
    if (!seenNames.has(starterNorm) && !seenIds.has(starterCleanId)) {
      seenNames.add(starterNorm);
      seenIds.add(starterCleanId);
      result.push({
        ...starter,
        id: starterCleanId,
      });
    }
  }

  return result;
}

export function InfiniteCraftView() {
  const [elements, setElements] = useState<InfiniteElement[]>(() => {
    try {
      const saved = JSON.stringify(readCraftElements());
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeElements(parsed);
        }
      }
    } catch {
      // Fallback
    }
    return sanitizeElements(STARTER_ELEMENTS);
  });

  useEffect(() => {
    const reload = () => {
      requestRef.current?.abort();
      setElements(sanitizeElements(readCraftElements()));
      setCanvasItems([]);
      setSelectedCanvasId(null);
      setCombineError(null);
      lastPairRef.current = null;
    };
    window.addEventListener(SAVE_IMPORTED_EVENT, reload);
    return () => window.removeEventListener(SAVE_IMPORTED_EVENT, reload);
  }, []);

  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([
    { instanceId: 'init-1', name: 'Water', emoji: '💧', x: 60, y: 100 },
    { instanceId: 'init-2', name: 'Fire', emoji: '🔥', x: 190, y: 100 },
    { instanceId: 'init-3', name: 'Wind', emoji: '💨', x: 60, y: 170 },
    { instanceId: 'init-4', name: 'Earth', emoji: '🌍', x: 190, y: 170 },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'time' | 'alpha' | 'discoveries' | 'shinies'>('time');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem(STORAGE_THEME_KEY) !== 'light');
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeCombination, setActiveCombination] = useState<ActiveCombination | null>(null);

  const [crucibleSlotA, setCrucibleSlotA] = useState<CrucibleSlotItem | null>(null);
  const [crucibleSlotB, setCrucibleSlotB] = useState<CrucibleSlotItem | null>(null);
  const [isCrucibleCollapsed, setIsCrucibleCollapsed] = useState(false);
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

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem(STORAGE_THEME_KEY, next ? 'dark' : 'light');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
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

  const shiniesCount = useMemo(() => elements.filter(el => Boolean(el.unlockedShiny || el.isShiny)).length, [elements]);

  const filteredElements = useMemo(() => {
    let list = sanitizeElements(elements);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(el => {
        if (el.name.toLowerCase().includes(q)) return true;
        const hasShiny = Boolean(el.unlockedShiny || el.isShiny);
        if (q === 'shiny' && hasShiny) return true;
        const phys = el.physicalData || generatePhysicalData(el.name, el.emoji, Boolean(el.isShiny));
        return phys.stateOfMatter.toLowerCase().includes(q) || phys.temperatureClass.toLowerCase().includes(q) || phys.conductivity.toLowerCase().includes(q) || phys.elementalAspect.toLowerCase().includes(q) || phys.cosmicTier.toLowerCase().includes(q) || phys.massClass.toLowerCase().includes(q);
      });
    }
    if (sortMode === 'time') list.sort((a, b) => (b.discoveredAt || 0) - (a.discoveredAt || 0));
    else if (sortMode === 'alpha') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === 'discoveries') list = list.filter(el => el.isNew);
    else if (sortMode === 'shinies') list = list.filter(el => Boolean(el.unlockedShiny || el.isShiny));
    return list;
  }, [elements, searchQuery, sortMode]);

  const [combineError, setCombineError] = useState<string | null>(null);
  const lastPairRef = useRef<Parameters<typeof handleCombine> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    requestRef.current?.abort();
    if (progressRef.current) clearInterval(progressRef.current);
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
      spawnParticles(targetX, targetY, isShinyEncounter || isNew);

      const newElemObj: InfiniteElement = {
        id: cleanId, name: cleanName, emoji: emoji || '✨', discoveredAt: Date.now(), isNew: Boolean(isNew), explanation: apiData.explanation, connection: apiData.connection,
        recipe: { first: itemA.name, second: itemB.name }, isShiny: isShinyEncounter, unlockedShiny: isShinyEncounter, shinyDiscoveredAt: isShinyEncounter ? Date.now() : undefined,
        physicalData: generatePhysicalData(cleanName, emoji || '✨', isShinyEncounter),
      };

      setElements(prev => {
        const existingIdx = prev.findIndex(el => el.id.toLowerCase() === cleanId || el.name.trim().toLowerCase() === normName);
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const updated = [...prev];
          updated[existingIdx] = {
            ...existing, explanation: existing.explanation || apiData.explanation, connection: existing.connection || apiData.connection,
            unlockedShiny: isShinyEncounter || existing.unlockedShiny, isShiny: isShinyEncounter ? true : existing.isShiny,
            shinyDiscoveredAt: existing.shinyDiscoveredAt || (isShinyEncounter ? Date.now() : undefined),
            physicalData: isShinyEncounter ? generatePhysicalData(cleanName, emoji || '✨', true) : (existing.physicalData || generatePhysicalData(cleanName, emoji || '✨', false)),
          };
          return updated;
        }
        return [newElemObj, ...prev];
      });

      const bonus = apiData.bonus;
      if (bonus && typeof bonus.result === 'string' && bonus.result.trim() && bonus.result.length <= 160 && typeof bonus.emoji === 'string' && bonus.emoji.trim() && bonus.emoji.length <= 32 && bonus.variantOf === cleanName && typeof bonus.explanation === 'string' && bonus.explanation.length <= 280) {
        const bonusElement: InfiniteElement = { id: bonus.result.toLowerCase().replace(/[^a-z0-9]/g, '_'), name: bonus.result, emoji: bonus.emoji, variantOf: bonus.variantOf, explanation: bonus.explanation, connection: 'rare variant', recipe: { first: itemA.name, second: itemB.name }, discoveredAt: Date.now() };
        setElements(prev => prev.some(e => e.name.toLowerCase() === bonus.result.toLowerCase()) ? prev : [bonusElement, ...prev]);
        setSpawnToast(`✦ Rare bonus: ${bonus.result}! ${cleanName} was also saved.`);
        setTimeout(() => setSpawnToast(null), 4500);
      }

      if (isShinyEncounter) {
        sound.playShiny(); haptics.shinySparkle(); if (!bonus) setSpawnToast(`✨ SHINY ${cleanName.toUpperCase()} DISCOVERED!`); setTimeout(() => setSpawnToast(null), 2500);
      } else if (isNew) {
        sound.playFirstDiscoveryChime(); haptics.firstDiscovery(); setFirstDiscoveryModal(newElemObj);
      } else {
        sound.playCraftPop(); haptics.discovery();
      }

      setCanvasItems(prev => {
        const filtered = prev.filter(it => it.instanceId !== itemA.idA && it.instanceId !== itemB.idB);
        return [...filtered, { instanceId: `inst-${Date.now()}-${Math.random()}`, name: cleanName, emoji: emoji || '✨', x: Math.max(20, Math.min(window.innerWidth - 300, targetX)), y: Math.max(20, Math.min(window.innerHeight - 150, targetY)), isNew, isShiny: isShinyEncounter }];
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

  const handleClearSlotA = () => { if (crucibleSlotA) { spawnOnCanvas(crucibleSlotA.name, crucibleSlotA.emoji, crucibleSlotA.isShiny); setCrucibleSlotA(null); } };
  const handleClearSlotB = () => { if (crucibleSlotB) { spawnOnCanvas(crucibleSlotB.name, crucibleSlotB.emoji, crucibleSlotB.isShiny); setCrucibleSlotB(null); } };
  const handleClearCrucibleAll = () => { if (crucibleSlotA) spawnOnCanvas(crucibleSlotA.name, crucibleSlotA.emoji, crucibleSlotA.isShiny); if (crucibleSlotB) spawnOnCanvas(crucibleSlotB.name, crucibleSlotB.emoji, crucibleSlotB.isShiny); setCrucibleSlotA(null); setCrucibleSlotB(null); };
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

  const spawnFromSidebar = (el: InfiniteElement) => {
    const isShinyUnlocked = Boolean(el.unlockedShiny || el.isShiny);
    const isShiny = Boolean(el.isShiny || (sortMode === 'shinies' && isShinyUnlocked));
    spawnOnCanvas(el.name, el.emoji, isShiny);
  };

  const spawnRandomElement = () => {
    if (!elements.length || isSynthesizing) return;
    const pool = sanitizeElements(elements);
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) return;
    spawnFromSidebar(chosen);
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
            haptics.mediumTap(); dropIntoCrucible(dragged); draggingItemRef.current = null; setActiveDragId(null); setHoverTargetId(null); setIsCrucibleHovered(false); return;
          }
        }
        const proximityThreshold = drag.isTouch ? 85 : 70;
        const targetItem = items.find(other => other.instanceId !== drag.instanceId && Math.hypot(other.x - dragged.x, other.y - dragged.y) < proximityThreshold);
        if (targetItem) { haptics.fusionPulse(); handleCombine({ name: dragged.name, emoji: dragged.emoji, x: dragged.x, y: dragged.y, idA: dragged.instanceId }, { name: targetItem.name, emoji: targetItem.emoji, x: targetItem.x, y: targetItem.y, idB: targetItem.instanceId }); }
      }
      draggingItemRef.current = null; setActiveDragId(null); setHoverTargetId(null); setIsCrucibleHovered(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', handlePointerUp); window.removeEventListener('pointercancel', handlePointerUp); };
  }, []);

  const clearCanvas = () => { sound.playClick(); haptics.heavyTap(); setCanvasItems([]); setSelectedCanvasId(null); };
  const firstDiscoveriesCount = elements.filter(el => el.isNew).length;
  const selectedItemObj = canvasItems.find(it => it.instanceId === selectedCanvasId);
  const hoverTargetObj = canvasItems.find(it => it.instanceId === hoverTargetId);
  const activeDragItem = canvasItems.find(it => it.instanceId === activeDragId);

  return (
    <div className={`w-full h-full flex-1 flex overflow-hidden select-none font-sans relative transition-colors duration-200 ${isDarkMode ? 'bg-[#101216] text-[#e4e4e7]' : 'bg-[#fafafa] text-[#18181b]'}`}>
      <div ref={canvasRef} className={`relative flex-1 h-full overflow-hidden cursor-crosshair touch-none select-none ${isDarkMode ? 'bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px]' : 'bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:24px_24px]'}`} onClick={() => { if (selectedCanvasId) setSelectedCanvasId(null); }}>
        <div className="absolute top-3 left-4 z-10 flex items-center gap-2 pointer-events-none">
          <div className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium backdrop-blur-md shadow-sm border flex items-center gap-2 ${isDarkMode ? 'bg-[#18181b]/85 border-[#27272a] text-[#a1a1aa]' : 'bg-white/85 border-[#e4e4e7] text-[#71717a]'}`}><span className="font-bold text-amber-500">Infinite Craft</span><span className="opacity-30">•</span><span>Drag or drop onto Combine Pad</span></div>
          {isSynthesizing && <div className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold bg-amber-500/20 text-amber-500 border border-amber-500/40 animate-pulse flex items-center gap-1.5 shadow-sm"><Sparkles className="w-3.5 h-3.5 animate-spin" /><span>Synthesizing...</span></div>}
        </div>

        {!isSidebarOpen && <button onClick={() => { sound.playClick(); setIsSidebarOpen(true); }} className={`absolute top-3 right-4 z-20 px-3.5 py-1.5 rounded-xl border shadow-lg font-medium text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-[#18181b] hover:bg-[#222329] border-[#2e333d] text-white' : 'bg-white hover:bg-zinc-50 border-[#d4d4d8] text-black'}`} title="Open Discoveries Sidebar (Press /)"><Sparkles className="w-3.5 h-3.5 text-amber-500" /><span className="font-semibold">Elements ({elements.length})</span><ChevronLeft className="w-3.5 h-3.5 text-zinc-400" /></button>}

        {selectedItemObj && <div className="absolute top-12 left-4 z-20 flex items-center gap-2"><div className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-amber-500 text-black shadow-md flex items-center gap-2 animate-fadeIn"><span>Selected: {selectedItemObj.emoji} {selectedItemObj.name}</span><button onClick={(e) => { e.stopPropagation(); dropIntoCrucible(selectedItemObj); setSelectedCanvasId(null); }} className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 text-[11px] font-bold text-black flex items-center gap-1 transition-colors" title="Send to Combine Pad"><Zap className="w-3 h-3" /><span>To Pad</span></button><button onClick={(e) => { e.stopPropagation(); setSelectedCanvasId(null); }} className="p-0.5 rounded hover:bg-black/20 text-black" title="Cancel selection"><X className="w-3.5 h-3.5" /></button></div></div>}

        {hoverTargetObj && activeDragItem && <><svg className="absolute inset-0 pointer-events-none z-20 w-full h-full"><line x1={activeDragItem.x + 50} y1={activeDragItem.y + 18} x2={hoverTargetObj.x + 50} y2={hoverTargetObj.y + 18} stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 4" className="animate-pulse" /></svg><div className="absolute pointer-events-none z-40 -translate-x-1/2 -translate-y-full transition-transform" style={{ left: (activeDragItem.x + hoverTargetObj.x) / 2 + 50, top: Math.min(activeDragItem.y, hoverTargetObj.y) - 14 }}><div className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500 text-black shadow-[0_4px_16px_rgba(245,158,11,0.5)] border border-amber-300 flex items-center gap-1.5 whitespace-nowrap animate-bounce"><Zap className="w-3.5 h-3.5 fill-black" /><span>Drop to Fuse: {activeDragItem.emoji} + {hoverTargetObj.emoji}</span></div></div></>}

        {combineError && <div role="alert" className="absolute top-4 left-4 right-4 z-30 rounded-xl bg-red-950 p-4 text-white border border-red-400"><p>{combineError}</p><button className="mt-2 rounded bg-white px-4 py-2 text-black" onClick={() => { if (lastPairRef.current) void handleCombine(lastPairRef.current[0], lastPairRef.current[1]); }}>Retry combination</button><button className="ml-3 p-2" onClick={() => setCombineError(null)}>Dismiss</button></div>}
        {spawnToast && <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none"><div className="px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold bg-zinc-900/90 border border-zinc-700 text-white shadow-xl backdrop-blur-md animate-fadeIn flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /><span>{spawnToast}</span></div></div>}

        <div className="absolute bottom-3 left-4 z-10 flex items-center gap-1.5 sm:gap-2">
          <button onClick={clearCanvas} className={`p-2 sm:px-3 sm:py-2 rounded-xl border shadow-sm transition-all flex items-center gap-1.5 text-xs font-medium active:scale-95 ${isDarkMode ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-white' : 'bg-white hover:bg-zinc-100 border-[#e4e4e7] text-[#71717a] hover:text-black'}`} title="Clear Board"><Trash2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Clear</span></button>
          <button onClick={tidyCanvas} className={`p-2 sm:px-3 sm:py-2 rounded-xl border shadow-sm transition-all flex items-center gap-1.5 text-xs font-medium active:scale-95 ${isDarkMode ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-white' : 'bg-white hover:bg-zinc-100 border-[#e4e4e7] text-[#71717a] hover:text-black'}`} title="Align elements into neat grid"><LayoutGrid className="w-3.5 h-3.5" /><span className="hidden sm:inline">Tidy</span></button>
          <button onClick={spawnRandomElement} disabled={!elements.length || isSynthesizing} className={`p-2 sm:px-3 sm:py-2 rounded-xl border shadow-sm transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${isDarkMode ? 'bg-[#1d2530] hover:bg-[#273342] border-[#334155] text-cyan-300' : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-800'}`} title="Drop a random unlocked element onto the canvas"><Shuffle className="w-3.5 h-3.5" /><span className="hidden sm:inline">Random</span></button>
          <button onClick={toggleTheme} className={`p-2 sm:p-2.5 rounded-xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-white' : 'bg-white hover:bg-zinc-100 border-[#e4e4e7] text-[#71717a] hover:text-black'}`} title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>{isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}</button>
          <button onClick={() => sound.toggleMute()} className={`p-2 sm:p-2.5 rounded-xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-white' : 'bg-white hover:bg-zinc-100 border-[#e4e4e7] text-[#71717a] hover:text-black'}`} title="Toggle Sound">{sound.isMuted() ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}</button>
          <div className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-medium shadow-sm ${isDarkMode ? 'bg-[#18181b] border-[#27272a] text-[#71717a]' : 'bg-white border-[#e4e4e7] text-[#a1a1aa]'}`}>{canvasItems.length} items</div>
        </div>

        {!isSidebarOpen && <button onClick={() => { sound.playClick(); setIsSidebarOpen(true); }} className="lg:hidden absolute bottom-3 right-4 z-20 px-4 py-2.5 rounded-xl border shadow-xl bg-amber-500 text-black font-bold text-xs flex items-center gap-2 active:scale-95 transition-transform"><Sparkles className="w-4 h-4" /><span>Elements ({elements.length})</span></button>}

        {particles.map(p => <div key={p.id} className="absolute rounded-full pointer-events-none" style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color, opacity: p.alpha, boxShadow: `0 0 8px ${p.color}`, transform: 'translate(-50%, -50%)' }} />)}
        <CombineAnimationOverlay combination={activeCombination} isDarkMode={isDarkMode} />

        {canvasItems.map(item => {
          const isSelected = selectedCanvasId === item.instanceId;
          const isHoveredTarget = hoverTargetId === item.instanceId;
          const isDragging = activeDragId === item.instanceId;
          return <div key={item.instanceId} onPointerDown={e => handlePointerDown(item, e)} onClick={e => { e.stopPropagation(); handleCanvasItemClick(item); }} onDoubleClick={e => handleDuplicate(item, e)} style={{ transform: `translate3d(${item.x}px, ${item.y}px, 0)`, transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.15s ease', willChange: 'transform', touchAction: 'none' }} className={`absolute top-0 left-0 cursor-grab active:cursor-grabbing select-none px-3.5 py-2 rounded-xl border flex items-center gap-2 font-medium text-xs shadow-sm group ${item.isShiny ? 'shiny-holographic-pill text-amber-100 font-bold shadow-[0_0_16px_rgba(251,191,36,0.4)]' : isDarkMode ? 'bg-[#18181b] hover:bg-[#202024] border-[#2e2e33] text-[#f4f4f5]' : 'bg-white hover:bg-zinc-50 border-[#d4d4d8] text-[#18181b]'} ${isDragging ? 'ring-2 ring-amber-400 scale-110 shadow-[0_12px_28px_rgba(0,0,0,0.35)] z-40 opacity-95 pointer-events-none' : isSelected ? 'ring-2 ring-amber-500 scale-105 shadow-[0_0_18px_rgba(245,158,11,0.45)] z-30' : isHoveredTarget ? 'ring-2 ring-emerald-500 scale-110 shadow-[0_0_22px_rgba(16,185,129,0.55)] z-30 animate-pulse' : 'z-10 hover:shadow-md'}`}>
            <span className="text-xl leading-none select-none pointer-events-none">{item.emoji}</span><span className="text-xs font-semibold tracking-wide whitespace-nowrap pointer-events-none">{item.name}</span>{item.isShiny && <span className="text-[10px] text-amber-400 font-bold shiny-star-twinkle pointer-events-none" title="Shiny Variant">✨</span>}
            <div className="hidden sm:group-hover:flex items-center gap-0.5 ml-1"><button onClick={e => { e.stopPropagation(); dropIntoCrucible(item); }} title="Send to Combine Pad" className="p-1 rounded hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 transition-colors"><Zap className="w-3 h-3" /></button><button onClick={e => handleDuplicate(item, e)} title="Duplicate (+)" className="p-1 rounded hover:bg-zinc-700/30 text-zinc-400 hover:text-zinc-200 transition-colors"><Plus className="w-3 h-3" /></button><button onClick={e => handleRemoveFromCanvas(item.instanceId, e)} title="Remove" className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"><X className="w-3 h-3" /></button></div>
          </div>;
        })}

        <CraftingCrucible slotA={crucibleSlotA} slotB={crucibleSlotB} onClearSlotA={handleClearSlotA} onClearSlotB={handleClearSlotB} onClearAll={handleClearCrucibleAll} onSwapSlots={handleSwapCrucible} onCombine={handleCrucibleCombine} isSynthesizing={isSynthesizing} isDarkMode={isDarkMode} isDropTargetActive={isCrucibleHovered} crucibleRef={crucibleRef} isCollapsed={isCrucibleCollapsed} onToggleCollapse={() => setIsCrucibleCollapsed(prev => !prev)} />
      </div>

      {isSidebarOpen && <div onClick={() => { sound.playClick(); setIsSidebarOpen(false); }} className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden transition-opacity animate-fadeIn" aria-label="Close elements tray" />}

      <aside className={`w-80 lg:w-88 xl:w-96 flex flex-col h-full border-l transition-all duration-200 z-40 ${isDarkMode ? 'bg-[#14161a] border-[#27272a]' : 'bg-white border-[#e4e4e7]'} ${isSidebarOpen ? 'fixed inset-y-0 right-0 max-w-[90vw] shadow-2xl flex lg:static lg:max-w-none lg:shadow-none' : 'hidden'}`}>
        <div className={`p-3.5 border-b flex flex-col gap-2.5 ${isDarkMode ? 'border-[#27272a]' : 'border-[#e4e4e7]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-xs font-bold tracking-wider font-mono uppercase text-amber-500">DISCOVERIES</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${isDarkMode ? 'bg-[#27272a] text-[#a1a1aa]' : 'bg-zinc-100 text-[#71717a]'}`}>{elements.length}</span>{firstDiscoveriesCount > 0 && <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"><Sparkles className="w-2.5 h-2.5" /><span>{firstDiscoveriesCount}</span></div>}</div>
            <button onClick={() => { sound.playClick(); setIsSidebarOpen(false); }} className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs font-medium ${isDarkMode ? 'border-[#27272a] bg-[#1c1f26] text-zinc-400 hover:text-white hover:border-zinc-600' : 'border-[#e4e4e7] bg-zinc-100 text-zinc-600 hover:text-black hover:border-zinc-300'}`} title="Close Elements (Esc)"><X className="w-4 h-4" /><span className="text-[11px] font-mono pr-0.5">Close</span></button>
          </div>

          <DiscoveryTrails elements={elements} busy={isSynthesizing} onPrepare={(a, b) => { setCrucibleSlotA(a); setCrucibleSlotB(b); setIsCrucibleCollapsed(false); setIsSidebarOpen(false); setSpawnToast('Ingredients ready. Tap Combine to continue your trail.'); setTimeout(() => setSpawnToast(null), 3000); }} />
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input ref={searchInputRef} type="text" placeholder="Search elements... (Press /)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDarkMode ? 'bg-[#1c1f26] border-[#2e333d] text-white placeholder-zinc-500' : 'bg-zinc-50 border-[#d4d4d8] text-black placeholder-zinc-400'}`} />{searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"><X className="w-3.5 h-3.5" /></button>}</div>

          <div className="flex items-center gap-1.5 pt-0.5">{STARTER_ELEMENTS.map(pe => <button key={pe.id} onClick={() => spawnFromSidebar(pe)} className={`flex-1 py-1 px-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs ${isDarkMode ? 'bg-[#1a1c22] hover:bg-[#232732] border-[#282e3c] text-white hover:border-amber-500/40' : 'bg-zinc-50 hover:bg-white border-zinc-200 text-zinc-800 hover:border-amber-400'}`} title={`Spawn ${pe.name}`}><span className="text-sm leading-none">{pe.emoji}</span><span className="text-[10px] font-medium hidden xs:inline">{pe.name}</span></button>)}</div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-1">
              <button onClick={() => setSortMode('time')} className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${sortMode === 'time' ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-bold' : isDarkMode ? 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black'}`} title="Sort by recently discovered"><Clock className="w-3 h-3" /><span>Recent</span></button>
              <button onClick={() => setSortMode('alpha')} className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${sortMode === 'alpha' ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-bold' : isDarkMode ? 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black'}`} title="Sort alphabetically"><ArrowDownAZ className="w-3 h-3" /><span>A-Z</span></button>
              {firstDiscoveriesCount > 0 && <button onClick={() => setSortMode('discoveries')} className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${sortMode === 'discoveries' ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-bold' : isDarkMode ? 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black'}`} title="First discoveries only"><Sparkles className="w-3 h-3 text-amber-500" /><span>Starred</span></button>}
              {shiniesCount > 0 && <button onClick={() => setSortMode(sortMode === 'shinies' ? 'time' : 'shinies')} className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-all ${sortMode === 'shinies' ? 'bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 font-bold border-amber-300 shadow-sm' : isDarkMode ? 'bg-[#18181b] border-[#27272a] text-amber-300 hover:text-amber-200' : 'bg-zinc-100 border-zinc-200 text-amber-700 hover:text-amber-900'}`} title="Filter rare Pokémon-style shiny mutations"><span className="shiny-star-twinkle">✨</span><span>Shinies ({shiniesCount})</span></button>}
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">{filteredElements.length} items</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-wrap content-start gap-1.5 select-none">
          {filteredElements.map(el => {
            const isShinyUnlocked = Boolean(el.unlockedShiny || el.isShiny);
            const isDisplayShiny = Boolean(el.isShiny || (sortMode === 'shinies' && isShinyUnlocked));
            return <div key={el.id} onClick={() => spawnFromSidebar(el)} className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border cursor-pointer select-none transition-all duration-100 shadow-sm hover:scale-[1.02] active:scale-95 ${isDisplayShiny ? 'shiny-holographic-pill text-amber-100 font-semibold' : isDarkMode ? 'bg-[#1c1f26] hover:bg-[#252a34] border-[#2e333d] text-[#f4f4f5]' : 'bg-zinc-50 hover:bg-white border-[#d4d4d8] text-[#18181b]'}`}><span className="text-base leading-none select-none">{el.emoji}</span><span className="text-xs font-semibold tracking-wide">{el.name}</span>{el.variantOf && <span title={`Rare variant of ${el.variantOf}`} className="text-[10px] font-bold text-violet-400">✦ Rare</span>}{el.isNew && <span className="text-[10px] text-amber-500 font-bold" title="First Discovery">★</span>}{isShinyUnlocked && <span className="text-[10px] text-amber-400 shiny-star-twinkle" title="Shiny form unlocked!">✨</span>}<button onClick={e => { e.stopPropagation(); sound.playClick(); setInspectedElement(el); }} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-cyan-400 transition-opacity ml-0.5 p-0.5" title="Inspect Physical Properties & Shiny Codex"><Info className="w-3.5 h-3.5" /></button></div>;
          })}
          {filteredElements.length === 0 && <div className="w-full text-center py-12 text-zinc-400 text-xs font-mono">No matching elements discovered.</div>}
        </div>

        <div className={`p-3 border-t flex items-center justify-between lg:hidden ${isDarkMode ? 'bg-[#101216] border-[#27272a]' : 'bg-zinc-50 border-[#e4e4e7]'}`}><span className="text-[11px] text-zinc-400 font-mono">Tap any element to spawn</span><button onClick={() => { sound.playClick(); setIsSidebarOpen(false); }} className="px-4 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs shadow-md active:scale-95 transition-transform">Return to Canvas</button></div>
      </aside>

      {firstDiscoveryModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setFirstDiscoveryModal(null)}><div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl text-center relative overflow-hidden ${isDarkMode ? 'bg-[#18181b] border-amber-500/40 text-white' : 'bg-white border-amber-400 text-black'}`}><div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" /><div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" /><div className="text-5xl mb-3 animate-bounce">{firstDiscoveryModal.emoji}</div><div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-mono font-bold tracking-widest uppercase mb-2"><Sparkles className="w-3.5 h-3.5" />FIRST DISCOVERY!</div><h3 className="text-2xl font-black tracking-tight mb-1">{firstDiscoveryModal.name}</h3><p className="text-xs text-zinc-400 mb-5 leading-relaxed">You are the very first crafter to unlock this combination in the global matrix!</p>{firstDiscoveryModal.recipe && <div className={`p-3 rounded-xl border text-xs font-mono mb-5 ${isDarkMode ? 'bg-black/30 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'}`}>{firstDiscoveryModal.recipe.first} + {firstDiscoveryModal.recipe.second} = {firstDiscoveryModal.name}</div>}<button onClick={() => { sound.playClick(); setFirstDiscoveryModal(null); }} className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-lg transition-all active:scale-95">Continue Crafting</button></div></div>}

      {inspectedElement && <ElementDossierModal element={inspectedElement} onClose={() => setInspectedElement(null)} onSpawnOnCanvas={(name, emoji, isShiny) => spawnOnCanvas(name, emoji, isShiny)} isDarkMode={isDarkMode} />}
    </div>
  );
}
