import { db } from '@/database/db';
import type { Attachment, AudioRecording, FileTransfer, TransferStatus } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { isRemoteConfigured } from '@/utils/env';
import { createId } from '@/utils/id';

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function onTransfersChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function visibleTransfer(
  record: { remotePath: string | null; syncStatus: Attachment['syncStatus'] | AudioRecording['syncStatus'] },
  queued: FileTransfer | undefined,
): TransferStatus {
  if (queued) return queued.status;
  // Sincronizado só com caminho remoto de um upload concluído.
  if (record.remotePath && record.syncStatus === 'synced') return 'sincronizado';
  if (record.syncStatus === 'error') return 'erro';
  return 'aguardando';
}

export function transferText(status: TransferStatus): string {
  if (status === 'sincronizando') return 'Sincronizando';
  if (status === 'sincronizado') return 'Sincronizado';
  if (status === 'erro') return 'Erro';
  return 'Aguardando';
}

/**
 * Sem storage de verdade o upload não existe.
 * Devolver null mantém o arquivo em aguardando — nunca vira sincronizado.
 */
export async function uploadLocalFile(): Promise<string | null> {
  if (!isRemoteConfigured()) return null;
  return null;
}

async function markUploaded(row: FileTransfer, remotePath: string): Promise<void> {
  const updatedAt = nowIso();
  if (row.target === 'attachment') {
    const current = await db.attachments.get(row.targetId);
    if (!current) return;
    await db.attachments.put({ ...current, remotePath, syncStatus: 'synced', updatedAt });
    return;
  }
  const current = await db.audio_recordings.get(row.targetId);
  if (!current) return;
  await db.audio_recordings.put({ ...current, remotePath, syncStatus: 'synced', updatedAt });
}

let pumping = false;

export async function pumpTransfers(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    const rows = await db.file_queue.filter((row) => row.status === 'aguardando' || row.status === 'sincronizando').toArray();
    for (const row of rows) {
      if (!isRemoteConfigured()) {
        if (row.status !== 'aguardando') {
          await db.file_queue.put({ ...row, status: 'aguardando', updatedAt: nowIso() });
          notify();
        }
        continue;
      }
      const sending: FileTransfer = { ...row, status: 'sincronizando', updatedAt: nowIso() };
      await db.file_queue.put(sending);
      notify();
      try {
        const remotePath = await uploadLocalFile();
        if (!remotePath) {
          await db.file_queue.put({ ...sending, status: 'aguardando', updatedAt: nowIso() });
          notify();
          continue;
        }
        await markUploaded(sending, remotePath);
        await db.file_queue.put({ ...sending, status: 'sincronizado', lastError: null, updatedAt: nowIso() });
        notify();
      } catch (error) {
        await db.file_queue.put({
          ...sending,
          status: 'erro',
          attempts: row.attempts + 1,
          lastError: error instanceof Error ? error.message : 'Falha no envio.',
          updatedAt: nowIso(),
        });
        notify();
      }
    }
  } finally {
    pumping = false;
  }
}

export async function enqueueTransfer(target: FileTransfer['target'], targetId: string): Promise<FileTransfer> {
  const existing = await db.file_queue.filter((row) => row.targetId === targetId).first();
  if (existing && existing.status !== 'erro') return existing;
  const row: FileTransfer = {
    id: existing?.id ?? createId(),
    target,
    targetId,
    status: 'aguardando',
    attempts: existing?.attempts ?? 0,
    lastError: null,
    updatedAt: nowIso(),
  };
  await db.file_queue.put(row);
  notify();
  void pumpTransfers();
  return row;
}

export async function retryTransfer(targetId: string): Promise<FileTransfer | null> {
  const existing = await db.file_queue.filter((row) => row.targetId === targetId).first();
  if (!existing || existing.status !== 'erro') return existing ?? null;
  const row: FileTransfer = { ...existing, status: 'aguardando', lastError: null, updatedAt: nowIso() };
  await db.file_queue.put(row);
  notify();
  void pumpTransfers();
  return row;
}

export async function dropTransfer(targetId: string): Promise<void> {
  const existing = await db.file_queue.filter((row) => row.targetId === targetId).first();
  if (!existing) return;
  await db.file_queue.delete(existing.id);
  notify();
}
