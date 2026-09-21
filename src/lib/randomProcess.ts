import type { Process } from '../types';

export function chooseRandomProcess(processes: Process[], currentId?: string, random = Math.random): Process | null {
  const unlocked = processes.filter(process => process.unlocked);
  const alternatives = unlocked.filter(process => process.id !== currentId);
  const pool = alternatives.length ? alternatives : unlocked;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
