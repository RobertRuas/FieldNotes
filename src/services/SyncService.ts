import { db } from '@/database/db';
import { preferenceGet, preferenceSet } from '@/services/platform/preferences';
import { supabaseGateway } from '@/services/supabaseGateway';
import { applyRemoteRecord, markSyncedIfUnchanged } from '@/sync/apply';
import { backoffMs } from '@/sync/engine';
import { countPendingOps, latestQueueError, onQueueDirty, resetStuckOps } from '@/sync/queue';
import type { SyncOperation } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { isRemoteConfigured } from '@/utils/env';

const LAST_PULL_KEY = 'fieldnotes.lastPullAt';

export interface SyncSnapshot {
  online: boolean;
  syncing: boolean;
  pending: number;
  remoteConfigured: boolean;
  lastError: string | null;
}

const listeners = new Set<(snapshot: SyncSnapshot) => void>();
const appliedListeners = new Set<() => void>();

let started = false;
let syncing = false;
let again = false;
let current: Promise<void> | null = null;
let lastError: string | null = null;

async function emit(): Promise<void> {
  const snapshot: SyncSnapshot = {
    online: navigator.onLine,
    syncing,
    pending: await countPendingOps(),
    remoteConfigured: isRemoteConfigured(),
    lastError,
  };
  listeners.forEach((listener) => listener(snapshot));
}

async function pushPending(): Promise<void> {
  const ops = await db.sync_queue
    .filter((row) => row.deletedAt === null && (row.status === 'pending' || row.status === 'failed'))
    .toArray();
  ops.sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1));
  const now = Date.now();
  let failed = false;
  for (const op of ops) {
    if (Date.parse(op.nextAttemptAt) > now) continue;
    const processing: SyncOperation = { ...op, status: 'processing', syncStatus: 'pending', updatedAt: nowIso() };
    await db.sync_queue.put(processing);
    try {
      const updatedAt = await supabaseGateway.push(op);
      await markSyncedIfUnchanged(op.entity, op.entityId, updatedAt);
      await db.sync_queue.delete(op.id);
    } catch (error) {
      failed = true;
      const attempts = op.attempts + 1;
      lastError = error instanceof Error ? error.message : 'Falha ao sincronizar.';
      const next: SyncOperation = {
        ...op,
        attempts,
        status: 'failed',
        syncStatus: 'error',
        lastError,
        nextAttemptAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
        updatedAt: nowIso(),
      };
      await db.sync_queue.put(next);
    }
  }
  if (!failed) lastError = await latestQueueError();
}

async function pullRemote(): Promise<void> {
  const since = (await preferenceGet(LAST_PULL_KEY)) ?? '1970-01-01T00:00:00.000Z';
  const changes = await supabaseGateway.pull(since);
  let applied = false;
  for (const change of changes) {
    const result = await applyRemoteRecord(change);
    if (result === 'applied') applied = true;
  }
  await preferenceSet(LAST_PULL_KEY, nowIso());
  if (applied) appliedListeners.forEach((listener) => listener());
}

async function run(): Promise<void> {
  do {
    again = false;
    // Sem rede ou sem Supabase, a fila fica no aparelho e a interface não espera.
    if (!navigator.onLine || !isRemoteConfigured()) break;
    syncing = true;
    await emit();
    try {
      await pushPending();
      await pullRemote();
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Falha ao sincronizar.';
    } finally {
      syncing = false;
    }
  } while (again);
  await emit();
}

function kick(): Promise<void> {
  if (current) {
    again = true;
    return current;
  }
  current = run().finally(() => {
    current = null;
  });
  return current;
}

export const SyncService = {
  start(): void {
    if (started) return;
    started = true;
    onQueueDirty(() => {
      void kick();
    });
    window.addEventListener('online', () => {
      void kick();
    });
    window.addEventListener('offline', () => {
      void emit();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void kick();
    });
    window.setInterval(() => {
      if (navigator.onLine && isRemoteConfigured()) void kick();
    }, 20_000);
    void resetStuckOps().then(() => kick());
  },

  subscribe(listener: (snapshot: SyncSnapshot) => void): void {
    listeners.add(listener);
  },

  onApplied(listener: () => void): void {
    appliedListeners.add(listener);
  },
};
