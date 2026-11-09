import type { Process } from '../types';
import { EXTRA_PROCESSES } from './extraProcesses';
import { FOUNDRY_ACTIONS } from './foundryActions';

/** Keep the saved unlock state authoritative when a catalog entry overlaps. */
export function availableProcesses(processes: Process[]): Process[] {
  const catalog = new Map<string, Process>();
  for (const process of [...processes, ...EXTRA_PROCESSES, ...FOUNDRY_ACTIONS]) {
    if (!catalog.has(process.id)) catalog.set(process.id, process);
  }
  return [...catalog.values()].filter(process => process.unlocked);
}
