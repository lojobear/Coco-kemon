import type { Process } from '../types';
import { ALL_PROCESSES } from './starterData';

/** Keep the saved unlock state authoritative when a catalog entry overlaps. */
export function availableProcesses(processes: Process[]): Process[] {
  const catalog = new Map<string, Process>();
  for (const process of [...processes, ...ALL_PROCESSES]) {
    if (!catalog.has(process.id)) catalog.set(process.id, process);
  }
  return [...catalog.values()].filter(process => process.unlocked);
}
