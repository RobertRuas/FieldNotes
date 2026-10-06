import { db } from '@/database/db';
import type { EntityMeta, SyncEntityName } from '@/types/entities';
import { canApplyRemoteUpdate } from '@/sync/merge';
import type { ParsedEntity } from '@/sync/parsers';

async function readLocal(entity: SyncEntityName, id: string): Promise<EntityMeta | undefined> {
  switch (entity) {
    case 'users':
      return db.users.get(id);
    case 'notes':
      return db.notes.get(id);
    case 'collections':
      return db.collections.get(id);
    case 'tasks':
      return db.tasks.get(id);
    case 'attachments':
      return db.attachments.get(id);
    case 'audio_recordings':
      return db.audio_recordings.get(id);
    case 'notifications':
      return db.notifications.get(id);
    case 'settings':
      return db.settings.get(id);
    case 'devices':
      return db.devices.get(id);
    default: {
      const neverEntity: never = entity;
      return neverEntity;
    }
  }
}

async function touchSynced<T extends EntityMeta>(
  row: T | undefined,
  updatedAt: string,
  save: (next: T) => Promise<unknown>,
): Promise<void> {
  if (!row || row.updatedAt !== updatedAt || row.syncStatus === 'synced') return;
  await save({ ...row, syncStatus: 'synced' });
}

async function markTable(entity: SyncEntityName, id: string, updatedAt: string): Promise<void> {
  switch (entity) {
    case 'users':
      return touchSynced(await db.users.get(id), updatedAt, (next) => db.users.put(next));
    case 'notes':
      return touchSynced(await db.notes.get(id), updatedAt, (next) => db.notes.put(next));
    case 'collections':
      return touchSynced(await db.collections.get(id), updatedAt, (next) => db.collections.put(next));
    case 'tasks':
      return touchSynced(await db.tasks.get(id), updatedAt, (next) => db.tasks.put(next));
    case 'attachments':
      return touchSynced(await db.attachments.get(id), updatedAt, (next) => db.attachments.put(next));
    case 'audio_recordings':
      return touchSynced(await db.audio_recordings.get(id), updatedAt, (next) => db.audio_recordings.put(next));
    case 'notifications':
      return touchSynced(await db.notifications.get(id), updatedAt, (next) => db.notifications.put(next));
    case 'settings':
      return touchSynced(await db.settings.get(id), updatedAt, (next) => db.settings.put(next));
    case 'devices':
      return touchSynced(await db.devices.get(id), updatedAt, (next) => db.devices.put(next));
    default: {
      const neverEntity: never = entity;
      return neverEntity;
    }
  }
}

export async function markSyncedIfUnchanged(entity: SyncEntityName, id: string, updatedAt: string): Promise<void> {
  await markTable(entity, id, updatedAt);
}

export async function applyRemoteRecord(parsed: ParsedEntity): Promise<'applied' | 'kept-local'> {
  const local = await readLocal(parsed.entity, parsed.record.id);
  if (!canApplyRemoteUpdate(local, parsed.record.updatedAt)) return 'kept-local';
  switch (parsed.entity) {
    case 'users':
      await db.users.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    case 'notes':
      await db.notes.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    case 'collections':
      await db.collections.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    case 'tasks':
      await db.tasks.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    case 'attachments':
      await db.attachments.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    case 'audio_recordings':
      await db.audio_recordings.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    case 'notifications':
      await db.notifications.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    case 'settings':
      await db.settings.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    case 'devices':
      await db.devices.put({ ...parsed.record, syncStatus: 'synced' });
      break;
    default: {
      const neverParsed: never = parsed;
      return neverParsed;
    }
  }
  return 'applied';
}
