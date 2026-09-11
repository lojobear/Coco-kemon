/**
 * ODDKIN FOUNDRY - Experiment Laboratory Notebook
 * Chronological log of all attempted recipes, observations,
 * and scientific breadcrumbs/hints for player experimentation.
 */

import React from 'react';
import { useGame } from '../lib/gameStore';
import { sound } from '../lib/audio';
import { BookOpen, CheckCircle2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';

export function NotebookView() {
  const { experiments } = useGame();

  return (
    <div className="w-full flex-1 max-w-2xl mx-auto px-3 py-4 space-y-4 font-mono select-none">
      {/* Notebook Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#282d37]">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#f3f4f6] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            LABORATORY NOTEBOOK
          </h2>
          <p className="text-xs text-[#9ca3af]">
            Empirical log of synthesis trials, reactions, and physical observations.
          </p>
        </div>

        <span className="px-2.5 py-1 rounded-lg bg-[#1a1d25] border border-[#2b3140] text-xs font-bold text-[#e5e7eb]">
          {experiments.length} Logs
        </span>
      </div>

      {/* Log list */}
      <div className="space-y-3">
        {experiments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#14161c] border border-dashed border-[#292f3d] text-center space-y-2">
            <span className="text-3xl">📝</span>
            <div className="text-xs font-bold text-[#f3f4f6]">No experiments logged yet.</div>
            <p className="text-[11px] text-[#9ca3af] max-w-xs mx-auto">
              Slot materials into the reaction chamber and apply processes. Every trial will be recorded here with scientific observations!
            </p>
          </div>
        ) : (
          experiments.map(exp => (
            <div
              key={exp.id}
              className={`p-3.5 rounded-xl border transition-all ${
                exp.isOddkinEmergence
                  ? 'bg-[#191524] border-purple-800/60 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                  : exp.success
                  ? 'bg-[#151821] border-[#2d3545]'
                  : 'bg-[#1a1718] border-red-900/40'
              }`}
            >
              {/* Top row: Inputs & Process */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-amber-400">
                    {exp.inputNames.join(' + ')}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#6b7280]" />
                  <span className="px-1.5 py-0.5 rounded bg-[#202532] text-[#c084fc] font-semibold text-[10px]">
                    [{exp.processName}]
                  </span>
                </div>

                <span className="text-[10px] text-[#6b7280]">
                  {new Date(exp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Outcome & Result */}
              <div className="pt-2 flex items-start gap-2.5">
                <div className="mt-0.5">
                  {exp.isOddkinEmergence ? (
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  ) : exp.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  )}
                </div>

                <div className="space-y-1 flex-1 text-xs">
                  {exp.resultName && (
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>Result:</span>
                      <span className={exp.isOddkinEmergence ? 'text-purple-300 font-pixel text-[11px]' : 'text-emerald-300'}>
                        {exp.resultName}
                      </span>
                    </div>
                  )}

                  <p className="text-[#cbd5e1] text-[11px] leading-relaxed">
                    "{exp.observation}"
                  </p>

                  {exp.hint && (
                    <div className="text-[10px] text-amber-400/90 font-medium bg-amber-950/30 px-2 py-1 rounded border border-amber-900/40 mt-1">
                      💡 Researcher Note: {exp.hint}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
