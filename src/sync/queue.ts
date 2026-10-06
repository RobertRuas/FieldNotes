import type { EntityTable } from 'dexie';
import { db } from '@/database/db';
import type { EntityMeta, SyncEntityName, SyncOperation, SyncOperationKind } from '@/types/entities';
import { createId } from '@/utils/id';

const listeners = new Set<() => void>();

export function onQueueDirty(listener: () => void): void {
  listeners.add(listener);
}

function notifyQueueDirty(): void {
  listeners.forEach((listener) => listener());
}

export async function countPendingOps(): Promise<number> {
  return db.sync_queue
    .filter((row) => row.deletedAt === null && (row.status === 'pending' || row.status === 'failed' || row.status === 'processing'))
    .count();
}

export async function latestQueueError(): Promise<string | null> {
  const rows = await db.sync_queue.filter((row) => row.deletedAt === null && row.lastError !== null).toArray();
  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return rows[0]?.lastError ?? null;
}

export async function resetStuckOps(): Promise<void> {
  const stuck = await db.sync_queue.filter((row) => row.status === 'processing' && row.deletedAt === null).toArray();
  await Promise.all(
    stuck.map((row) => db.sync_queue.put({ ...row, status: 'pending', syncStatus: 'pending' })),
  );
}

export async function enqueueWrite<T extends EntityMeta>(
  table: EntityTable<T, 'id'>,
  entity: SyncEntityName,
  record: T,
  operation: SyncOperationKind,
): Promise<void> {
  const stored: T = { ...record, syncStatus: 'pending' };
  const now = stored.updatedAt;
  await db.transaction('rw', table, db.sync_queue, async () => {
    await table.put(stored);
    const pending = await db.sync_queue
      .filter(
        (row) =>
          row.entity === entity &&
          row.entityId === stored.id &&
          row.deletedAt === null &&
          row.status !== 'processing',
      )
      .first();
    if (pending) {
      const next: SyncOperation = {
        ...pending,
        operation,
        payload: JSON.stringify(stored),
        updatedAt: now,
        attempts: 0,
        status: 'pending',
        syncStatus: 'pending',
        nextAttemptAt: now,
        lastError: null,
        deletedAt: null,
      };
      await db.sync_queue.put(next);
      return;
    }
    const created: SyncOperation = {
      id: createId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      entity,
      entityId: stored.id,
      operation,
      payload: JSON.stringify(stored),
      attempts: 0,
      nextAttemptAt: now,
      lastError: null,
      status: 'pending',
    };
    await db.sync_queue.put(created);
  });
  notifyQueueDirty();
}
