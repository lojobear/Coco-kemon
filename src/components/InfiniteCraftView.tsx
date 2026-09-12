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
import { LidarSynthesisModal, ActiveSynthesisSession } from './LidarSynthesisModal';
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
} from 'lucide-react';

interface CanvasItem {
  instanceId: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  isNew?: boolean;
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
  // Elements state
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

  // Canvas board items
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([
    { instanceId: 'init-1', name: 'Water', emoji: '💧', x: 60, y: 100 },
    { instanceId: 'init-2', name: 'Fire', emoji: '🔥', x: 190, y: 100 },
    { instanceId: 'init-3', name: 'Wind', emoji: '💨', x: 60, y: 170 },
    { instanceId: 'init-4', name: 'Earth', emoji: '🌍', x: 190, y: 170 },
  ]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'time' | 'alpha' | 'discoveries'>('time');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_THEME_KEY) !== 'light';
  });
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisSession, setSynthesisSession] = useState<ActiveSynthesisSession | null>(null);
  const skipRequestedRef = useRef<boolean>(false);
  const [firstDiscoveryModal, setFirstDiscoveryModal] = useState<InfiniteElement | null>(null);
  const [inspectedElement, setInspectedElement] = useState<InfiniteElement | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Responsive sidebar open/close state: open by default on desktop, closed on small mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Temporary toast feedback when spawning on mobile
  const [spawnToast, setSpawnToast] = useState<string | null>(null);

  // Dragging state
  const canvasRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const draggingItemRef = useRef<{
    instanceId: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // Hover target for fusion drop
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);

  // Save elements to localStorage
  useEffect(() => {
    try {
      const sanitized = sanitizeElements(elements);
      saveCraftElements(sanitized);
    } catch (e) {
      console.error('Failed to save infinite craft elements', e);
    }
  }, [elements]);

  // Save theme
  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem(STORAGE_THEME_KEY, next ? 'dark' : 'light');
  };

  // Keyboard shortcut: Press / to focus search, Esc to close modals or sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (firstDiscoveryModal) {
          setFirstDiscoveryModal(null);
        } else if (inspectedElement) {
          setInspectedElement(null);
        } else if (selectedCanvasId) {
          setSelectedCanvasId(null);
        } else if (isSidebarOpen && window.innerWidth < 1024) {
          setIsSidebarOpen(false);
        }
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        setIsSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [firstDiscoveryModal, inspectedElement, selectedCanvasId, isSidebarOpen]);

  // Particle animation ticker
  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            alpha: p.alpha - 0.04,
            size: p.size * 0.96,
          }))
          .filter(p => p.alpha > 0.05)
      );
    }, 24);
    return () => clearInterval(interval);
  }, [particles.length]);

  const spawnParticles = (x: number, y: number, isGold = false) => {
    const colors = isGold
      ? ['#fbbf24', '#f59e0b', '#d97706', '#fef08a', '#ffffff']
      : ['#60a5fa', '#93c5fd', '#38bdf8', '#c084fc', '#f472b6'];
    const newBatch: Particle[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5);
      const speed = Math.random() * 4 + 2;
      newBatch.push({
        id: `part-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 5 + 3,
        alpha: 1,
      });
    }
    setParticles(prev => [...prev.slice(-40), ...newBatch]);
  };

  // Sort & filter sidebar elements (with strict uniqueness guarantee)
  const filteredElements = useMemo(() => {
    let list = sanitizeElements(elements);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(el => el.name.toLowerCase().includes(q));
    }
    if (sortMode === 'time') {
      list.sort((a, b) => (b.discoveredAt || 0) - (a.discoveredAt || 0));
    } else if (sortMode === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'discoveries') {
      list = list.filter(el => el.isNew);
    }
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

  // Skip active synthesis immediately
  const handleSkipSynthesis = () => {
    skipRequestedRef.current = true;
  };

  // Pair two elements via Neal's endpoint: /api/infinite-craft/pair?first=A&second=B
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
    skipRequestedRef.current = false;
    sound.playLidarSweep();

    const targetX = (itemA.x + itemB.x) / 2;
    const targetY = (itemA.y + itemB.y) / 2;

    const sessionObj: ActiveSynthesisSession = {
      id: `synth-${Date.now()}`,
      itemA: { name: itemA.name, emoji: itemA.emoji || '✨' },
      itemB: { name: itemB.name, emoji: itemB.emoji || '✨' },
      targetX,
      targetY,
      progress: 8,
      stageText: 'Finding a combination...',
    };
    setSynthesisSession(sessionObj);

    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const p = Math.min(90, 8 + (Date.now() - startTime) / 200);
      setSynthesisSession(prev => prev ? { ...prev, progress: p,
        stageText: skipRequestedRef.current ? 'Waiting for the result...' : 'Finding a combination...' } : null);
    }, 100);

    try {
      const apiData = await requestJson<InfiniteCraftPairResponse>(
        `/api/infinite-craft/pair?first=${encodeURIComponent(itemA.name)}&second=${encodeURIComponent(itemB.name)}`,
        { signal: controller.signal }
      );
      if (typeof apiData.result !== 'string' || !apiData.result.trim() ||
          typeof apiData.emoji !== 'string' || typeof apiData.isNew !== 'boolean') {
        throw new Error('The server returned an invalid combination. Please retry.');
      }
      if (controller.signal.aborted) return;
      if (progressRef.current) clearInterval(progressRef.current);
      setSynthesisSession(prev => prev ? { ...prev, progress: 100, stageText: 'Discovery ready!',
        result: { name: apiData.result, emoji: apiData.emoji, isNew: apiData.isNew } } : null);
      if (!skipRequestedRef.current) await new Promise(resolve => setTimeout(resolve, 220));
      if (controller.signal.aborted) return;
      if (apiData && apiData.result) {
        const { result, emoji, isNew } = apiData;

        // Spawn puff particles
        spawnParticles(targetX + 50, targetY + 20, isNew);

        const cleanName = result.trim();
        const normName = cleanName.toLowerCase();
        const cleanId = normName.replace(/[^a-z0-9]/g, '_');

        const newElemObj: InfiniteElement = {
          id: cleanId,
          name: cleanName,
          emoji: emoji || '✨',
          discoveredAt: Date.now(),
          isNew: Boolean(isNew),
          recipe: { first: itemA.name, second: itemB.name },
        };

        // Atomic, functional deduplication check
        setElements(prev => {
          const alreadyDiscovered = prev.some(
            el => el.id.toLowerCase() === cleanId || el.name.trim().toLowerCase() === normName
          );
          if (alreadyDiscovered) {
            return prev;
          }
          return [newElemObj, ...prev];
        });

        // If it's a first discovery ever
        if (isNew) {
          sound.playFirstDiscoveryChime();
          setFirstDiscoveryModal(newElemObj);
        } else {
          sound.playCraftPop();
        }

        // Remove the two fused items from canvas and replace with result
        setCanvasItems(prev => {
          const filtered = prev.filter(
            it => it.instanceId !== itemA.idA && it.instanceId !== itemB.idB
          );
          return [
            ...filtered,
            {
              instanceId: `inst-${Date.now()}-${Math.random()}`,
              name: cleanName,
              emoji: emoji || '✨',
              x: Math.max(20, Math.min(window.innerWidth - 300, targetX)),
              y: Math.max(20, Math.min(window.innerHeight - 150, targetY)),
              isNew,
            },
          ];
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) setCombineError(err instanceof Error ? err.message : 'Combination failed. Please retry.');
    } finally {
      if (progressRef.current) clearInterval(progressRef.current);
      progressRef.current = null;
      requestRef.current = null;
      setSynthesisSession(null);
      setIsSynthesizing(false);
      setSelectedCanvasId(null);
      setHoverTargetId(null);
    }
  };

  // Click on canvas item to select or combine
  const handleCanvasItemClick = (item: CanvasItem) => {
    sound.playClick();
    if (!selectedCanvasId) {
      setSelectedCanvasId(item.instanceId);
    } else if (selectedCanvasId === item.instanceId) {
      setSelectedCanvasId(null);
    } else {
      // Clicked second item: trigger combination!
      const firstItem = canvasItems.find(it => it.instanceId === selectedCanvasId);
      if (firstItem) {
        handleCombine(
          { name: firstItem.name, x: firstItem.x, y: firstItem.y, idA: firstItem.instanceId },
          { name: item.name, x: item.x, y: item.y, idB: item.instanceId }
        );
      }
    }
  };

  // Double click canvas item: Duplicate it
  const handleDuplicate = (item: CanvasItem, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    const newItem: CanvasItem = {
      instanceId: `dup-${Date.now()}-${Math.random()}`,
      name: item.name,
      emoji: item.emoji,
      x: item.x + 25,
      y: item.y + 25,
      isNew: item.isNew,
    };
    setCanvasItems(prev => [...prev, newItem]);
  };

  // Remove single item from canvas
  const handleRemoveFromCanvas = (instanceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    setCanvasItems(prev => prev.filter(it => it.instanceId !== instanceId));
    if (selectedCanvasId === instanceId) setSelectedCanvasId(null);
  };

  // Spawn element from sidebar onto canvas
  const spawnFromSidebar = (el: InfiniteElement) => {
    sound.playClick();
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const width = canvasBounds ? canvasBounds.width : 500;
    const height = canvasBounds ? canvasBounds.height : 400;

    // Spawn around center-left with pleasant jitter
    const x = Math.max(30, width / 2 - 100 + (Math.random() * 140 - 70));
    const y = Math.max(30, height / 2 - 60 + (Math.random() * 120 - 60));

    const newItem: CanvasItem = {
      instanceId: `spawn-${Date.now()}-${Math.random()}`,
      name: el.name,
      emoji: el.emoji,
      x,
      y,
      isNew: el.isNew,
    };

    setCanvasItems(prev => [...prev, newItem]);

    // Show temporary toast feedback
    setSpawnToast(`${el.emoji} ${el.name} added`);
    setTimeout(() => setSpawnToast(null), 1800);

    // If an item is already selected on canvas, combine directly
    if (selectedCanvasId) {
      const selected = canvasItems.find(it => it.instanceId === selectedCanvasId);
      if (selected) {
        handleCombine(
          { name: selected.name, x: selected.x, y: selected.y, idA: selected.instanceId },
          { name: el.name, x: x, y: y, idB: newItem.instanceId }
        );
      }
    }
  };

  // Tidy / Align all canvas items into a neat responsive grid
  const tidyCanvas = () => {
    sound.playClick();
    if (canvasItems.length === 0) return;

    const startX = 40;
    const startY = 70;
    const itemWidth = 145;
    const itemHeight = 52;
    const canvasWidth = canvasRef.current?.clientWidth || 600;
    const cols = Math.max(1, Math.floor((canvasWidth - 80) / itemWidth));

    setCanvasItems(prev =>
      prev.map((item, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
          ...item,
          x: startX + col * itemWidth,
          y: startY + row * itemHeight,
        };
      })
    );
  };

  // Mouse & Touch Dragging Handlers
  const handleMouseDown = (item: CanvasItem, e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    draggingItemRef.current = {
      instanceId: item.instanceId,
      offsetX: clientX - item.x,
      offsetY: clientY - item.y,
      startX: clientX,
      startY: clientY,
      moved: false,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingItemRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      if (!draggingItemRef.current.moved && Math.hypot(clientX - draggingItemRef.current.startX, clientY - draggingItemRef.current.startY) < 6) return;
      draggingItemRef.current.moved = true;
      const newX = clientX - draggingItemRef.current.offsetX;
      const newY = clientY - draggingItemRef.current.offsetY;
      const draggedId = draggingItemRef.current.instanceId;

      setCanvasItems(prev =>
        prev.map(it => (it.instanceId === draggedId ? { ...it, x: newX, y: newY } : it))
      );

      // Check proximity with other items for drop fusion
      const dragged = canvasItems.find(it => it.instanceId === draggedId);
      if (dragged) {
        let nearestId: string | null = null;
        for (const other of canvasItems) {
          if (other.instanceId === draggedId) continue;
          const dist = Math.hypot(other.x - newX, other.y - newY);
          if (dist < 65) {
            nearestId = other.instanceId;
            break;
          }
        }
        setHoverTargetId(nearestId);
      }
    };

    const handleUp = () => {
      if (!draggingItemRef.current) return;
      const draggedId = draggingItemRef.current.instanceId;
      const dragged = canvasItems.find(it => it.instanceId === draggedId);

      // A stationary tap selects an item; only an actual drag can trigger drop fusion.
      if (dragged && draggingItemRef.current.moved) {
        for (const other of canvasItems) {
          if (other.instanceId === draggedId) continue;
          const dist = Math.hypot(other.x - dragged.x, other.y - dragged.y);
          if (dist < 75) {
            // Fused!
            handleCombine(
              { name: dragged.name, x: dragged.x, y: dragged.y, idA: dragged.instanceId },
              { name: other.name, x: other.x, y: other.y, idB: other.instanceId }
            );
            break;
          }
        }
      }

      draggingItemRef.current = null;
      setHoverTargetId(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [canvasItems]);

  const clearCanvas = () => {
    sound.playClick();
    setCanvasItems([]);
    setSelectedCanvasId(null);
  };

  const firstDiscoveriesCount = elements.filter(el => el.isNew).length;

  // Selected item object (if any)
  const selectedItemObj = canvasItems.find(it => it.instanceId === selectedCanvasId);

  // Hover target object (if any)
  const hoverTargetObj = canvasItems.find(it => it.instanceId === hoverTargetId);

  return (
    <div
      className={`w-full h-full flex-1 flex overflow-hidden select-none font-sans relative transition-colors duration-200 ${
        isDarkMode ? 'bg-[#101216] text-[#e4e4e7]' : 'bg-[#fafafa] text-[#18181b]'
      }`}
    >
      {/* LEFT: Freeform Crafting Canvas */}
      <div
        ref={canvasRef}
        className={`relative flex-1 h-full overflow-hidden cursor-crosshair ${
          isDarkMode
            ? 'bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px]'
            : 'bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:24px_24px]'
        }`}
        onClick={() => {
          if (selectedCanvasId) setSelectedCanvasId(null);
        }}
      >
        {/* Canvas Top Left Banner */}
        <div className="absolute top-3 left-4 z-10 flex items-center gap-2 pointer-events-none">
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium backdrop-blur-md shadow-sm border flex items-center gap-2 ${
              isDarkMode
                ? 'bg-[#18181b]/85 border-[#27272a] text-[#a1a1aa]'
                : 'bg-white/85 border-[#e4e4e7] text-[#71717a]'
            }`}
          >
            <span className="font-bold text-amber-500">Infinite Craft</span>
            <span className="opacity-30">•</span>
            <span>Drag or tap elements to combine</span>
          </div>

          {isSynthesizing && (
            <div className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold bg-amber-500/20 text-amber-500 border border-amber-500/40 animate-pulse flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Synthesizing...</span>
            </div>
          )}
        </div>

        {/* Top Right Toggle Button (When Sidebar is Closed) */}
        {!isSidebarOpen && (
          <button
            onClick={() => {
              sound.playClick();
              setIsSidebarOpen(true);
            }}
            className={`absolute top-3 right-4 z-20 px-3.5 py-1.5 rounded-xl border shadow-lg font-medium text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${
              isDarkMode
                ? 'bg-[#18181b] hover:bg-[#222329] border-[#2e333d] text-white'
                : 'bg-white hover:bg-zinc-50 border-[#d4d4d8] text-black'
            }`}
            title="Open Discoveries Sidebar (Press /)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold">Elements ({elements.length})</span>
            <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}

        {/* Selected Item Notification Banner */}
        {selectedItemObj && (
          <div className="absolute top-12 left-4 z-10 flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-amber-500 text-black shadow-md flex items-center gap-2 animate-fadeIn">
              <span>Selected: {selectedItemObj.emoji} {selectedItemObj.name}</span>
              <span className="opacity-60">•</span>
              <span className="font-normal text-[11px]">Click another item or sidebar element to combine!</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCanvasId(null);
                }}
                className="ml-1 p-0.5 rounded hover:bg-black/20 text-black"
                title="Cancel selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Fusion Proximity Indicator */}
        {hoverTargetObj && (
          <div className="absolute top-12 right-4 z-10">
            <div className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-emerald-500 text-black shadow-md flex items-center gap-1.5 animate-bounce">
              <Zap className="w-3.5 h-3.5" />
              <span>Release to Fuse with {hoverTargetObj.emoji} {hoverTargetObj.name}!</span>
            </div>
          </div>
        )}

        {/* Floating Canvas Toast Feedback */}
        {combineError && (
          <div role="alert" className="absolute top-4 left-4 right-4 z-30 rounded-xl bg-red-950 p-4 text-white border border-red-400">
            <p>{combineError}</p>
            <button className="mt-2 rounded bg-white px-4 py-2 text-black" onClick={() => {
              if (lastPairRef.current) void handleCombine(lastPairRef.current[0], lastPairRef.current[1]);
            }}>Retry combination</button>
            <button className="ml-3 p-2" onClick={() => setCombineError(null)}>Dismiss</button>
          </div>
        )}
        {spawnToast && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold bg-zinc-900/90 border border-zinc-700 text-white shadow-xl backdrop-blur-md animate-fadeIn flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{spawnToast}</span>
            </div>
          </div>
        )}

        {/* Canvas Bottom Control Bar */}
        <div className="absolute bottom-3 left-4 z-10 flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={clearCanvas}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl border shadow-sm transition-all flex items-center gap-1.5 text-xs font-medium active:scale-95 ${
              isDarkMode
                ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-white'
                : 'bg-white hover:bg-zinc-100 border-[#e4e4e7] text-[#71717a] hover:text-black'
            }`}
            title="Clear Board"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            onClick={tidyCanvas}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl border shadow-sm transition-all flex items-center gap-1.5 text-xs font-medium active:scale-95 ${
              isDarkMode
                ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-white'
                : 'bg-white hover:bg-zinc-100 border-[#e4e4e7] text-[#71717a] hover:text-black'
            }`}
            title="Align elements into neat grid"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tidy</span>
          </button>

          <button
            onClick={toggleTheme}
            className={`p-2 sm:p-2.5 rounded-xl border shadow-sm transition-all active:scale-95 ${
              isDarkMode
                ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-white'
                : 'bg-white hover:bg-zinc-100 border-[#e4e4e7] text-[#71717a] hover:text-black'
            }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
          </button>

          <button
            onClick={() => sound.toggleMute()}
            className={`p-2 sm:p-2.5 rounded-xl border shadow-sm transition-all active:scale-95 ${
              isDarkMode
                ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-white'
                : 'bg-white hover:bg-zinc-100 border-[#e4e4e7] text-[#71717a] hover:text-black'
            }`}
            title="Toggle Sound"
          >
            {sound.isMuted() ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          <div
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-medium shadow-sm ${
              isDarkMode ? 'bg-[#18181b] border-[#27272a] text-[#71717a]' : 'bg-white border-[#e4e4e7] text-[#a1a1aa]'
            }`}
          >
            {canvasItems.length} items
          </div>
        </div>

        {/* Mobile Floating Button (Always Visible when closed on mobile) */}
        {!isSidebarOpen && (
          <button
            onClick={() => {
              sound.playClick();
              setIsSidebarOpen(true);
            }}
            className="lg:hidden absolute bottom-3 right-4 z-20 px-4 py-2.5 rounded-xl border shadow-xl bg-amber-500 text-black font-bold text-xs flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Sparkles className="w-4 h-4" />
            <span>Elements ({elements.length})</span>
          </button>
        )}

        {/* Particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              opacity: p.alpha,
              boxShadow: `0 0 8px ${p.color}`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* Render Floating Canvas Items */}
        {canvasItems.map(item => {
          const isSelected = selectedCanvasId === item.instanceId;
          const isHoveredTarget = hoverTargetId === item.instanceId;

          return (
            <div
              key={item.instanceId}
              onMouseDown={e => handleMouseDown(item, e)}
              onTouchStart={e => handleMouseDown(item, e)}
              onClick={e => {
                e.stopPropagation();
                handleCanvasItemClick(item);
              }}
              onDoubleClick={e => handleDuplicate(item, e)}
              style={{
                left: item.x,
                top: item.y,
              }}
              className={`absolute cursor-grab active:cursor-grabbing select-none px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-all duration-75 shadow-sm group ${
                isDarkMode
                  ? 'bg-[#18181b] hover:bg-[#202024] border-[#2e2e33] text-[#f4f4f5]'
                  : 'bg-white hover:bg-zinc-50 border-[#d4d4d8] text-[#18181b]'
              } ${
                isSelected
                  ? 'ring-2 ring-amber-500 scale-105 shadow-[0_0_15px_rgba(245,158,11,0.4)] z-20'
                  : ''
              } ${
                isHoveredTarget
                  ? 'ring-2 ring-emerald-500 scale-110 shadow-[0_0_20px_rgba(16,185,129,0.5)] z-20'
                  : 'z-10'
              }`}
            >
              <span className="text-lg leading-none select-none">{item.emoji}</span>
              <span className="text-xs font-semibold tracking-wide whitespace-nowrap">{item.name}</span>

              {/* Quick Actions (Duplicate & Delete) */}
              <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                <button
                  onClick={e => handleDuplicate(item, e)}
                  title="Duplicate (+)"
                  className="p-1 rounded hover:bg-zinc-700/30 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={e => handleRemoveFromCanvas(item.instanceId, e)}
                  title="Remove"
                  className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MOBILE BACKDROP OVERLAY: Tapping anywhere outside the elements tray immediately closes it! */}
      {isSidebarOpen && (
        <div
          onClick={() => {
            sound.playClick();
            setIsSidebarOpen(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden transition-opacity animate-fadeIn"
          aria-label="Close elements tray"
        />
      )}

      {/* RIGHT: Discovered Elements Sidebar */}
      <aside
        className={`w-80 lg:w-88 xl:w-96 flex flex-col h-full border-l transition-all duration-200 z-40 ${
          isDarkMode ? 'bg-[#14161a] border-[#27272a]' : 'bg-white border-[#e4e4e7]'
        } ${
          isSidebarOpen
            ? 'fixed inset-y-0 right-0 max-w-[90vw] shadow-2xl flex lg:static lg:max-w-none lg:shadow-none'
            : 'hidden'
        }`}
      >
        {/* Sidebar Header & Controls */}
        <div className={`p-3.5 border-b flex flex-col gap-2.5 ${isDarkMode ? 'border-[#27272a]' : 'border-[#e4e4e7]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider font-mono uppercase text-amber-500">
                DISCOVERIES
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  isDarkMode ? 'bg-[#27272a] text-[#a1a1aa]' : 'bg-zinc-100 text-[#71717a]'
                }`}
              >
                {elements.length}
              </span>
              {firstDiscoveriesCount > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{firstDiscoveriesCount}</span>
                </div>
              )}
            </div>

            {/* Prominent Close Button to solve "I can't close the elements tab" */}
            <button
              onClick={() => {
                sound.playClick();
                setIsSidebarOpen(false);
              }}
              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs font-medium ${
                isDarkMode
                  ? 'border-[#27272a] bg-[#1c1f26] text-zinc-400 hover:text-white hover:border-zinc-600'
                  : 'border-[#e4e4e7] bg-zinc-100 text-zinc-600 hover:text-black hover:border-zinc-300'
              }`}
              title="Close Elements (Esc)"
            >
              <X className="w-4 h-4" />
              <span className="text-[11px] font-mono pr-0.5">Close</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search elements... (Press /)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isDarkMode
                  ? 'bg-[#1c1f26] border-[#2e333d] text-white placeholder-zinc-500'
                  : 'bg-zinc-50 border-[#d4d4d8] text-black placeholder-zinc-400'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primordial 4 Pinned Quick-Bar */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {STARTER_ELEMENTS.map(pe => (
              <button
                key={pe.id}
                onClick={() => spawnFromSidebar(pe)}
                className={`flex-1 py-1 px-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs ${
                  isDarkMode
                    ? 'bg-[#1a1c22] hover:bg-[#232732] border-[#282e3c] text-white hover:border-amber-500/40'
                    : 'bg-zinc-50 hover:bg-white border-zinc-200 text-zinc-800 hover:border-amber-400'
                }`}
                title={`Spawn ${pe.name}`}
              >
                <span className="text-sm leading-none">{pe.emoji}</span>
                <span className="text-[10px] font-medium hidden xs:inline">{pe.name}</span>
              </button>
            ))}
          </div>

          {/* Sorting Filters */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSortMode('time')}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  sortMode === 'time'
                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-bold'
                    : isDarkMode
                    ? 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-white'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black'
                }`}
                title="Sort by recently discovered"
              >
                <Clock className="w-3 h-3" />
                <span>Recent</span>
              </button>

              <button
                onClick={() => setSortMode('alpha')}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  sortMode === 'alpha'
                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-bold'
                    : isDarkMode
                    ? 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-white'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black'
                }`}
                title="Sort alphabetically"
              >
                <ArrowDownAZ className="w-3 h-3" />
                <span>A-Z</span>
              </button>

              {firstDiscoveriesCount > 0 && (
                <button
                  onClick={() => setSortMode('discoveries')}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    sortMode === 'discoveries'
                      ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-bold'
                      : isDarkMode
                      ? 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-white'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-black'
                  }`}
                  title="First discoveries only"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Starred</span>
                </button>
              )}
            </div>

            <span className="text-[11px] text-zinc-400 font-mono">
              {filteredElements.length} items
            </span>
          </div>
        </div>

        {/* Elements Grid List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-wrap content-start gap-1.5 select-none">
          {filteredElements.map(el => (
            <div
              key={el.id}
              onClick={() => spawnFromSidebar(el)}
              className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all duration-100 shadow-sm hover:scale-[1.02] active:scale-95 ${
                isDarkMode
                  ? 'bg-[#1c1f26] hover:bg-[#252a34] border-[#2e333d] text-[#f4f4f5]'
                  : 'bg-zinc-50 hover:bg-white border-[#d4d4d8] text-[#18181b]'
              }`}
            >
              <span className="text-base leading-none select-none">{el.emoji}</span>
              <span className="text-xs font-semibold tracking-wide">{el.name}</span>

              {el.isNew && (
                <span className="text-[10px] text-amber-500" title="First Discovery">
                  ★
                </span>
              )}

              {/* Recipe Info Button */}
              {el.recipe && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    sound.playClick();
                    setInspectedElement(el);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-200 transition-opacity ml-0.5 p-0.5"
                  title="Inspect Recipe"
                >
                  <Info className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {filteredElements.length === 0 && (
            <div className="w-full text-center py-12 text-zinc-400 text-xs font-mono">
              No matching elements discovered.
            </div>
          )}
        </div>

        {/* Mobile Bottom Return Button */}
        <div className={`p-3 border-t flex items-center justify-between lg:hidden ${
          isDarkMode ? 'bg-[#101216] border-[#27272a]' : 'bg-zinc-50 border-[#e4e4e7]'
        }`}>
          <span className="text-[11px] text-zinc-400 font-mono">Tap any element to spawn</span>
          <button
            onClick={() => {
              sound.playClick();
              setIsSidebarOpen(false);
            }}
            className="px-4 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs shadow-md active:scale-95 transition-transform"
          >
            Return to Canvas
          </button>
        </div>
      </aside>

      {/* MODAL: First Discovery Celebratory Toast */}
      {firstDiscoveryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setFirstDiscoveryModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl text-center relative overflow-hidden ${
              isDarkMode
                ? 'bg-[#18181b] border-amber-500/40 text-white'
                : 'bg-white border-amber-400 text-black'
            }`}
          >
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="text-5xl mb-3 animate-bounce">{firstDiscoveryModal.emoji}</div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-mono font-bold tracking-widest uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              FIRST DISCOVERY!
            </div>

            <h3 className="text-2xl font-black tracking-tight mb-1">{firstDiscoveryModal.name}</h3>

            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              You are the very first crafter to unlock this combination in the global matrix!
            </p>

            {firstDiscoveryModal.recipe && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono mb-5 ${
                  isDarkMode ? 'bg-black/30 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'
                }`}
              >
                {firstDiscoveryModal.recipe.first} + {firstDiscoveryModal.recipe.second} = {firstDiscoveryModal.name}
              </div>
            )}

            <button
              onClick={() => {
                sound.playClick();
                setFirstDiscoveryModal(null);
              }}
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-lg transition-all active:scale-95"
            >
              Continue Crafting
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Recipe Lineage Inspector */}
      {inspectedElement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setInspectedElement(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl relative ${
              isDarkMode ? 'bg-[#18181b] border-[#27272a] text-white' : 'bg-white border-[#e4e4e7] text-black'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{inspectedElement.emoji}</span>
                <div>
                  <h4 className="font-bold text-base">{inspectedElement.name}</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">RECIPE LINEAGE</span>
                </div>
              </div>
              <button
                onClick={() => setInspectedElement(null)}
                className="p-1 rounded-lg hover:bg-zinc-700/20 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inspectedElement.recipe ? (
              <div className="space-y-2.5">
                <div
                  className={`p-3 rounded-xl border text-sm font-mono flex items-center justify-center gap-2 ${
                    isDarkMode ? 'bg-black/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <span className="font-semibold text-amber-400">{inspectedElement.recipe.first}</span>
                  <span className="text-zinc-400">+</span>
                  <span className="font-semibold text-amber-400">{inspectedElement.recipe.second}</span>
                  <span className="text-zinc-400">=</span>
                  <span className="font-bold text-emerald-400">{inspectedElement.name}</span>
                </div>
                <p className="text-[11px] text-zinc-400 text-center">
                  Discovered on {new Date(inspectedElement.discoveredAt || Date.now()).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <div className="text-xs text-zinc-400 py-3 text-center">
                This is a primordial starter element.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
