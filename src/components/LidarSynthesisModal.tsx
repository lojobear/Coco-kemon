import React from 'react';
import { Sparkles, Zap, Radio, FastForward, CheckCircle2 } from 'lucide-react';
import { LidarPointcloudCanvas } from './LidarPointcloudCanvas';

export interface ActiveSynthesisSession {
  id: string;
  itemA: { name: string; emoji?: string };
  itemB: { name: string; emoji?: string };
  targetX: number;
  targetY: number;
  progress: number; // 0 to 100
  stageText: string;
  result?: {
    name: string;
    emoji: string;
    isNew: boolean;
  };
}

interface LidarSynthesisModalProps {
  session: ActiveSynthesisSession | null;
  onSkip?: () => void;
  isDarkMode?: boolean;
}

export function LidarSynthesisModal({
  session,
  onSkip,
  isDarkMode = true,
}: LidarSynthesisModalProps) {
  if (!session) return null;

  const { itemA, itemB, progress, stageText, result } = session;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none animate-fadeIn">
      {/* Tactical Holographic LiDAR Synthesis Terminal Card */}
      <div
        className={`relative w-full max-w-[360px] rounded-3xl p-5 border shadow-2xl flex flex-col items-center gap-4 transition-all duration-200 ${
          isDarkMode
            ? 'bg-[#0f131c]/95 border-cyan-500/40 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.25)]'
            : 'bg-[#0b101c]/95 border-cyan-500/50 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.3)]'
        }`}
      >
        {/* Top Header & Telemetry */}
        <div className="w-full flex items-center justify-between border-b border-cyan-900/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-mono font-bold text-cyan-400 tracking-wider">
              LIDAR SYNTHESIS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-cyan-300/70 border border-cyan-800/80 rounded px-1.5 py-0.5">
              905nm • 240Hz
            </span>
            {onSkip && (
              <button
                onClick={onSkip}
                className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40 transition-colors text-[11px] font-mono flex items-center gap-1"
                title="Skip animation"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Skip</span>
              </button>
            )}
          </div>
        </div>

        {/* Reactants Collision Bar */}
        <div className="w-full flex items-center justify-center gap-2 py-1">
          {/* Reactant A */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center gap-1.5 shadow-sm max-w-[130px] truncate">
            <span className="text-base">{itemA.emoji || '✨'}</span>
            <span className="text-xs font-semibold text-slate-200 truncate">
              {itemA.name}
            </span>
          </div>

          {/* Fusion Spark */}
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.5)] animate-pulse">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
          </div>

          {/* Reactant B */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center gap-1.5 shadow-sm max-w-[130px] truncate">
            <span className="text-base">{itemB.emoji || '✨'}</span>
            <span className="text-xs font-semibold text-slate-200 truncate">
              {itemB.name}
            </span>
          </div>
        </div>

        {/* 3D LiDAR Point Cloud Viewport */}
        <div className="w-full flex justify-center py-1">
          <LidarPointcloudCanvas
            itemA={itemA.name}
            itemB={itemB.name}
            progress={progress}
            emergingEmoji={result?.emoji}
            width={280}
            height={280}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Synthesizing Progress & Stage Status */}
        <div className="w-full flex flex-col gap-2">
          {/* Status Label & Percentage */}
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="truncate max-w-[210px]">{stageText}</span>
            </div>
            <span className="font-bold text-cyan-400 text-sm">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Glowing Laser Progress Bar */}
          <div className="relative w-full h-3 rounded-full bg-slate-950 border border-cyan-950 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 transition-all duration-100 relative"
              style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
            >
              {/* Laser Shimmer Leading Edge */}
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white blur-[2px] shadow-[0_0_12px_#ffffff]" />
            </div>
          </div>

          {/* Bottom Diagnostics Strip */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>POINT DENSITY: 1,450 PTS</span>
            </div>

            {result ? (
              <div className="flex items-center gap-1 text-emerald-400 font-semibold animate-fadeIn">
                <CheckCircle2 className="w-3 h-3" />
                <span>RESOLVED: {result.name}</span>
              </div>
            ) : (
              <span className="text-cyan-400/70 animate-pulse">MATERIALIZING...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
