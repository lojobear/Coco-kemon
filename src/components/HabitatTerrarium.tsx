/**
 * ODDKIN FOUNDRY - Habitat Terrarium Dioramas
 * Miniature animated pixel-art enclosures where living Oddkin roam,
 * snooze, chirp on tap, and forage for passive matter discoveries.
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../lib/gameStore';
import { Habitat, Oddkin } from '../types';
import { sound } from '../lib/audio';
import { Sparkles, Trees, Hammer, Droplets, Flower2, Plus, Volume2 } from 'lucide-react';

export function HabitatTerrarium() {
  const {
    habitats,
    oddkinCollection,
    activeHabitatId,
    assignOddkinToHabitat,
    harvestHabitat,
  } = useGame();

  const [currentHabId, setCurrentHabId] = useState<string>(activeHabitatId || 'hab_woodland');
  const [activeOddkinAnim, setActiveOddkinAnim] = useState<Record<string, { x: number; y: number; dir: number }>>({});
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);

  const currentHabitat = habitats.find(h => h.id === currentHabId) || habitats[0];

  const residentOddkins = oddkinCollection.filter(o =>
    currentHabitat?.residentOddkinIds.includes(o.speciesId)
  );

  // Habitat icons
  const getHabitatIcon = (type: string) => {
    switch (type) {
      case 'woodland': return <Trees className="w-4 h-4 text-emerald-400" />;
      case 'workshop': return <Hammer className="w-4 h-4 text-amber-400" />;
      case 'bog': return <Droplets className="w-4 h-4 text-cyan-400" />;
      case 'garden': return <Flower2 className="w-4 h-4 text-pink-400" />;
      default: return <Trees className="w-4 h-4" />;
    }
  };

  // Background color scheme for terrarium diorama
  const getTerrariumStyles = (type: string) => {
    switch (type) {
      case 'woodland':
        return {
          bg: 'from-[#062015] via-[#0d2e20] to-[#04140d]',
          ground: '#133e2b',
          border: 'border-emerald-800/60',
          props: ['🌲', '🌿', '🍄', '🌱', '🪵'],
        };
      case 'workshop':
        return {
          bg: 'from-[#1c1917] via-[#292524] to-[#171514]',
          ground: '#3d3835',
          border: 'border-amber-800/60',
          props: ['⚙️', '🧪', '🕯️', '🔧', '🧲'],
        };
      case 'bog':
        return {
          bg: 'from-[#082026] via-[#0c2e38] to-[#05151a]',
          ground: '#0f3d4a',
          border: 'border-cyan-800/60',
          props: ['💧', '🪨', '🫧', '🐚', '🌊'],
        };
      case 'garden':
        return {
          bg: 'from-[#240e1e] via-[#381630] to-[#170913]',
          ground: '#4a1d40',
          border: 'border-pink-800/60',
          props: ['🌸', '🌺', '🪴', '✨', '🌻'],
        };
      default:
        return {
          bg: 'from-[#111317] to-[#090a0d]',
          ground: '#232833',
          border: 'border-stone-800',
          props: ['🌱'],
        };
    }
  };

  // Wandering positions for residents
  useEffect(() => {
    const initialPos: Record<string, { x: number; y: number; dir: number }> = {};
    residentOddkins.forEach((o, idx) => {
      initialPos[o.speciesId] = {
        x: 20 + ((idx * 28) % 65),
        y: 65 + (idx % 3) * 5,
        dir: idx % 2 === 0 ? 1 : -1,
      };
    });
    setActiveOddkinAnim(initialPos);

    // Wandering animation loop
    const interval = setInterval(() => {
      setActiveOddkinAnim(prev => {
        const next = { ...prev };
        residentOddkins.forEach(o => {
          if (next[o.speciesId]) {
            const current = next[o.speciesId];
            let newX = current.x + (Math.random() * 6 - 3);
            if (newX < 10) newX = 15;
            if (newX > 85) newX = 80;
            next[o.speciesId] = {
              x: newX,
              y: current.y,
              dir: newX >= current.x ? 1 : -1,
            };
          }
        });
        return next;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [currentHabId, residentOddkins.length]);

  const style = getTerrariumStyles(currentHabitat?.type || 'woodland');

  return (
    <div className="w-full flex-1 max-w-2xl mx-auto px-3 py-3 space-y-3 font-mono select-none">
      {/* Terrarium Selector Bar */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
        {habitats.map(hab => {
          const isSelected = hab.id === currentHabId;
          const residents = oddkinCollection.filter(o => hab.residentOddkinIds.includes(o.speciesId));
          return (
            <button
              key={hab.id}
              onClick={() => {
                sound.playClick();
                setCurrentHabId(hab.id);
              }}
              className={`flex-1 min-w-[120px] p-2 rounded-xl border flex items-center gap-2 transition-all ${
                isSelected
                  ? 'bg-[#232834] border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-[#15171d] border-[#262b36] hover:border-[#383f4d]'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-[#111317]">
                {getHabitatIcon(hab.type)}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white truncate">{hab.name}</div>
                <div className="text-[10px] text-[#9ca3af]">{residents.length} Oddkin</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. THE DIORAMA ENCLOSURE */}
      <div
        className={`relative w-full h-[280px] rounded-2xl bg-gradient-to-b ${style.bg} border-2 ${style.border} shadow-2xl overflow-hidden flex flex-col justify-between p-4 crt-scanlines`}
      >
        {/* Glass Reflection Header */}
        <div className="flex items-center justify-between text-xs z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-white tracking-wider">{currentHabitat.name.toUpperCase()}</span>
          </div>

          <button
            onClick={() => { sound.playClick(); setShowAssignModal(true); }}
            className="px-2.5 py-1 rounded-lg bg-[#111317]/80 hover:bg-[#1c2029] border border-[#333a49] text-[10px] font-bold text-[#f3f4f6] flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> Move Oddkin
          </button>
        </div>

        {/* Ambient Diorama Props */}
        <div className="absolute inset-0 flex justify-around items-center opacity-40 pointer-events-none text-2xl">
          {style.props.map((p, i) => (
            <span key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.4}s` }}>
              {p}
            </span>
          ))}
        </div>

        {/* Terrarium Ground Surface */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 border-t border-white/10"
          style={{ backgroundColor: style.ground }}
        />

        {/* Animated Resident Oddkin Sprites */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {residentOddkins.map(odd => {
            const pos = activeOddkinAnim[odd.speciesId] || { x: 50, y: 70, dir: 1 };
            return (
              <div
                key={odd.speciesId}
                onClick={(e) => {
                  e.stopPropagation();
                  sound.playOddkinChirp(odd.chirpToneHz, odd.temperament);
                }}
                className="absolute cursor-pointer pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 group flex flex-col items-center"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%) scaleX(${pos.dir})`,
                }}
                title={`${odd.speciesName} - Tap to hear chirp!`}
              >
                {/* Speech Bubble / Chirp Cue on Hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] bg-black/80 px-1.5 py-0.5 rounded text-amber-300 font-bold mb-1 border border-amber-500/40 pointer-events-none whitespace-nowrap">
                  ♫ {odd.speciesName}
                </div>

                <img
                  src={odd.customSpriteUrl}
                  alt={odd.speciesName}
                  className="w-14 h-14 pixelated drop-shadow-lg animate-bounce"
                  style={{ animationDuration: `${2.2 + (odd.chirpToneHz % 100) / 100}s` }}
                />
              </div>
            );
          })}
        </div>

        {/* Empty Terrarium state */}
        {residentOddkins.length === 0 && (
          <div className="z-10 flex flex-col items-center justify-center space-y-2 text-center py-16">
            <span className="text-3xl opacity-50">🍃</span>
            <div className="text-xs text-stone-300">
              No Oddkin currently reside in this diorama.
            </div>
            <button
              onClick={() => { sound.playClick(); setShowAssignModal(true); }}
              className="px-3 py-1.5 rounded-lg bg-[#242a38] hover:bg-[#30384a] text-xs font-bold text-amber-400 border border-amber-500/40"
            >
              Assign from Collection
            </button>
          </div>
        )}

        {/* Bottom Bar: Foraging / Passive Harvest */}
        <div className="flex items-center justify-between z-10 pt-2 border-t border-white/10">
          <div className="text-[10px] text-[#9ca3af] flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Tap any resident to hear its species chirp</span>
          </div>

          <button
            onClick={() => {
              harvestHabitat(currentHabitat.id);
            }}
            disabled={residentOddkins.length === 0}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-black text-xs font-bold transition-all flex items-center gap-1.5 shadow"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Harvest Foraged Matter
          </button>
        </div>
      </div>

      {/* ASSIGN RESIDENTS MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181b22] border-2 border-[#333b4b] rounded-2xl p-4 max-w-sm w-full max-h-[80vh] flex flex-col shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#282f3d]">
              <span className="text-xs font-bold text-white">
                ASSIGN ODDKIN TO {currentHabitat.name.toUpperCase()}
              </span>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-xs px-2 py-1 rounded bg-[#232733] text-[#9ca3af] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {oddkinCollection.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#6b7280]">
                  No Oddkin in your collection yet. Discover them in the Foundry!
                </div>
              ) : (
                oddkinCollection.map(odd => {
                  const isResident = currentHabitat.residentOddkinIds.includes(odd.speciesId);
                  return (
                    <div
                      key={odd.speciesId}
                      onClick={() => {
                        assignOddkinToHabitat(odd.speciesId, currentHabitat.id);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isResident
                          ? 'bg-purple-950/40 border-purple-500 text-white'
                          : 'bg-[#14161c] border-[#292f3d] text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={odd.customSpriteUrl}
                          alt={odd.speciesName}
                          className="w-10 h-10 pixelated"
                        />
                        <div>
                          <div className="text-xs font-bold text-white">{odd.speciesName}</div>
                          <div className="text-[10px] text-[#c084fc]">{odd.titleOrClassification}</div>
                        </div>
                      </div>

                      <span className="text-xs font-bold">
                        {isResident ? '✓ Resident' : '+ Move Here'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
