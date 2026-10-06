import type { SyncEntityName, SyncOperation } from '@/types/entities';
import { keysToSnake, parseEntity, type ParsedEntity } from '@/sync/parsers';
import { getSupabase } from '@/services/supabaseClient';
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
  const supabase = await getSupabase();
  if (!supabase) return null;
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

async function upsertParsed(entity: SyncEntityName, record: ParsedEntity['record']): Promise<void> {
  const remote = await client();
  if (!remote) throw new Error('Supabase não configurado.');
  const snake = keysToSnake({ ...record, syncStatus: 'synced' });
  if (!isRecord(snake)) throw new Error('Payload local inválido.');
  await remote.upsert(entity, snake);
}

export const supabaseGateway = {
  async push(op: SyncOperation): Promise<string> {
    const parsed = parseEntity(op.entity, parseJson(op.payload));
    if (!parsed) throw new Error('Payload local inválido.');
    await upsertParsed(op.entity, parsed.record);
    return parsed.record.updatedAt;
  },

  /** Grava a ficha direto, sem passar pela fila. O upload concluído usa isto. */
  async upsertRecord(entity: SyncEntityName, record: ParsedEntity['record']): Promise<void> {
    await upsertParsed(entity, record);
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
