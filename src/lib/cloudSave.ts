import { createClient } from '@supabase/supabase-js';
import { parseSave } from './saveData';

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const url = env?.VITE_SUPABASE_URL;
const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud = url && key ? createClient(url, key, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
}) : null;

export type CloudSave = { payload: unknown; revision: number; updated_at: string };
export const RECOVERY_KEY = 'coco_kemon_before_cloud_load';

async function accountToken(userId: string) {
  if (!cloud) throw new Error('Cloud saves are not configured yet.');
  const { data, error } = await cloud.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) {
    throw new Error('Your account changed or expired. Sign in again before saving.');
  }
  return data.session.access_token;
}

export function validateCloudPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  if (!json || new TextEncoder().encode(json).length > 8 * 1024 * 1024) {
    throw new Error('This save exceeds the cloud limit. Export a JSON backup instead.');
  }
  if ((payload as { version?: number })?.version !== 2) throw new Error('Unsupported cloud save version.');
  parseSave(json);
  return json;
}

export async function readCloudSave(userId: string): Promise<CloudSave | null> {
  if (!cloud) throw new Error('Cloud saves are not configured yet.');
  const token = await accountToken(userId);
  const { data, error } = await cloud.from('game_saves')
    .select('payload, revision, updated_at').eq('user_id', userId)
    .abortSignal(AbortSignal.timeout(20000)).maybeSingle().setHeader('Authorization', `Bearer ${token}`);
  if (error) throw new Error('Could not read your cloud save. Check your connection and try again.');
  if (data) validateCloudPayload(data.payload);
  return data;
}

export async function writeCloudSave(json: string, revision: number, userId: string): Promise<CloudSave> {
  if (!cloud) throw new Error('Cloud saves are not configured yet.');
  const payload = JSON.parse(json);
  validateCloudPayload(payload);
  const token = await accountToken(userId);
  const { data, error } = await cloud.rpc('write_game_save', {
    save_payload: payload, expected_revision: revision,
  }).abortSignal(AbortSignal.timeout(20000)).single().setHeader('Authorization', `Bearer ${token}`);
  if (error?.code === '40001') throw new Error('Another device saved newer progress. Refresh cloud info, then load it or explicitly replace it.');
  if (error) throw new Error('Cloud save failed. Your progress is still on this device. Check your connection and retry.');
  const saved = data as CloudSave;
  if (!saved || !Number.isInteger(saved.revision)) throw new Error('Could not confirm the save. Refresh cloud info before retrying.');
  return saved;
}

export function downloadBackup(json: string, prefix = 'coco-kemon-save') {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
