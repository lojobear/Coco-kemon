export interface ProcedurePreferences { favorites: string[]; recent: string[] }
export const PROCEDURE_PREFERENCES_KEY = 'boop-procedure-preferences-v1';
export function parseProcedurePreferences(raw: string | null): ProcedurePreferences {
  try {
    const data = JSON.parse(raw || '{}');
    const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && /^[A-Z0-9_]{1,80}$/.test(id)))].slice(0, 300) : [];
    return { favorites: ids(data?.favorites), recent: ids(data?.recent).slice(0, 6) };
  } catch { return { favorites: [], recent: [] }; }
}
export function rememberProcedure(preferences: ProcedurePreferences, id: string): ProcedurePreferences {
  return { ...preferences, recent: [id, ...preferences.recent.filter(value => value !== id)].slice(0, 6) };
}
