import type { SyncEntityName, SyncOperation } from '@/types/entities';
import { keysToSnake, parseEntity, type ParsedEntity } from '@/sync/parsers';
import { isRemoteConfigured } from '@/utils/env';
import { isRecord } from '@/utils/guards';
import { parseJson } from '@/utils/json';

const TABLES: readonly SyncEntityName[] = [
  'users',
  'notes',
  'collections',
  'tasks',
  'attachments',
  'audio_recordings',
  'notifications',
  'settings',
  'devices',
];

type RemoteRow = Record<string, unknown>;

interface RemoteClient {
  upsert(table: string, row: RemoteRow): Promise<void>;
  selectUpdatedSince(table: string, sinceIso: string): Promise<unknown[]>;
}

let remoteClient: Promise<RemoteClient | null> | null = null;

async function loadClient(): Promise<RemoteClient | null> {
  if (!isRemoteConfigured()) return null;
  const url = import.meta.env.VITE_SUPABASE_URL ?? '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const { createClient } = await import('@supabase/supabase-js');
  // Somente a anon key entra no cliente. A service role fica fora do app.
  const supabase = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return {
    async upsert(table: string, row: RemoteRow): Promise<void> {
      const { error } = await supabase.from(table).upsert(row);
      if (error) throw new Error(error.message);
    },
    async selectUpdatedSince(table: string, sinceIso: string): Promise<unknown[]> {
      const { data, error } = await supabase.from(table).select('*').gt('updated_at', sinceIso);
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) return [];
      return data.map((row) => row as unknown);
    },
  };
}

async function client(): Promise<RemoteClient | null> {
  if (!remoteClient) remoteClient = loadClient();
  return remoteClient;
}

export const supabaseGateway = {
  async push(op: SyncOperation): Promise<string> {
    const remote = await client();
    if (!remote) throw new Error('Supabase não configurado.');
    const parsed = parseEntity(op.entity, parseJson(op.payload));
    if (!parsed) throw new Error('Payload local inválido.');
    const snake = keysToSnake({ ...parsed.record, syncStatus: 'synced' });
    if (!isRecord(snake)) throw new Error('Payload local inválido.');
    await remote.upsert(op.entity, snake);
    return parsed.record.updatedAt;
  },

  async pull(sinceIso: string): Promise<ParsedEntity[]> {
    const remote = await client();
    if (!remote) return [];
    const changes: ParsedEntity[] = [];
    for (const table of TABLES) {
      const rows = await remote.selectUpdatedSince(table, sinceIso);
      for (const row of rows) {
        const parsed = parseEntity(table, row);
        if (parsed) changes.push(parsed);
      }
    }
    return changes;
  },
};
