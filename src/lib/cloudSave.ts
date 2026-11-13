import { createClient } from '@supabase/supabase-js';
import { parseSave } from './saveData';

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
// Public project identifiers; database access is enforced by Supabase Auth and RLS.
const url = env?.VITE_SUPABASE_URL || 'https://lrjszbguvqgdsqvvcoqe.supabase.co';
const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_y7dGWisvgKzLvRVpbzd0zw_BISm05fI';
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

export const CLOUD_SAVE_MAX_BYTES = 8 * 1024 * 1024;
export const CLOUD_SAVE_TIMEOUT_MS = 60_000;
export function cloudPayloadBytes(payload: unknown): number { return new TextEncoder().encode(JSON.stringify(payload)).length; }
export function validateCloudPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  if (!json || new TextEncoder().encode(json).length > CLOUD_SAVE_MAX_BYTES) {
    throw new Error('This save exceeds the cloud limit. Export a JSON backup instead.');
  }
  if (![2, 3].includes((payload as { version: number })?.version)) throw new Error('Unsupported cloud save version.');
  parseSave(json);
  return json;
}

export async function readCloudSave(userId: string): Promise<CloudSave | null> {
  if (!cloud) throw new Error('Cloud saves are not configured yet.');
  const token = await accountToken(userId);
  const { data, error } = await cloud.from('game_saves')
    .select('payload, revision, updated_at').eq('user_id', userId)
    .abortSignal(AbortSignal.timeout(CLOUD_SAVE_TIMEOUT_MS)).maybeSingle().setHeader('Authorization', `Bearer ${token}`);
  if (error) throw new Error('Could not read your cloud save. Check your connection and try again.');
  if (data) validateCloudPayload(data.payload);
  return data;
}

/** JSONB reorders object keys, so compare structure rather than serialization. */
export function sameCloudPayload(a:unknown,b:unknown):boolean {
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameCloudPayload(v,b[i]));
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>;
  const keys=Object.keys(x);
  return keys.length===Object.keys(y).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(y,k)&&sameCloudPayload(x[k],y[k]));
}
export function confirmedCloudWrite(saved:CloudSave|null, payload:unknown, revision:number):saved is CloudSave {
  return !!saved&&saved.revision===revision+1&&sameCloudPayload(saved.payload,payload);
}
export async function writeCloudSave(json: string, revision: number, userId: string): Promise<CloudSave> {
  if (!cloud) throw new Error('Cloud saves are not configured yet.');
  const payload = JSON.parse(json);
  validateCloudPayload(payload);
  const token = await accountToken(userId);
  const { data, error } = await cloud.rpc('write_game_save', {
    save_payload: payload, expected_revision: revision,
  }).abortSignal(AbortSignal.timeout(CLOUD_SAVE_TIMEOUT_MS)).single().setHeader('Authorization', `Bearer ${token}`);
  if (error?.code === '40001') throw new Error('Another device saved newer progress. Refresh cloud info, then load it or explicitly replace it.');
  if (error?.code === '23514') throw new Error('The cloud rejected this save because it exceeds a data or size limit. Export a device backup and retry after syncing sprites.');
  if (error?.code === '28000' || error?.code === '42501') throw new Error('Your cloud session is no longer authorized. Sign in again without clearing your device data.');
  const saved = data as CloudSave;
  if (!error && saved && Number.isInteger(saved.revision)) return saved;
  // A network timeout can occur AFTER Postgres commits. Confirm the exact
  // payload and expected next revision before reporting failure or retrying.
  // Never retry a write automatically or overwrite a newer revision.
  let latest:CloudSave|null=null;
  try { latest=await readCloudSave(userId); } catch { /* outcome remains unknown */ }
  if(confirmedCloudWrite(latest,payload,revision))return latest;
  if(latest&&latest.revision>revision)throw new Error('Cloud progress changed. Refresh cloud info before saving again; your device progress is unchanged.');
  throw new Error('Could not confirm the cloud save. Your device progress is unchanged. Refresh cloud info before retrying, or export a device backup.');
}

export function downloadBackup(json: string, prefix = 'coco-kemon-save') {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
