import { db } from '@/database/db';
import { StorageService } from '@/services/StorageService';
import { supabaseGateway } from '@/services/supabaseGateway';
import { FILES_BUCKET, getSupabase, hasRemoteSession } from '@/services/supabaseClient';
import { AuthService } from '@/services/AuthService';
import type { Attachment, AudioRecording, FileTransfer, TransferStatus } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { isRemoteConfigured } from '@/utils/env';
import { fileTooLarge } from '@/utils/files';
import { isRecord } from '@/utils/guards';
import { createId } from '@/utils/id';
import { parseJson } from '@/utils/json';

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

async function sourceBlob(row: FileTransfer): Promise<{ blob: Blob; name: string } | null> {
  if (row.target === 'attachment') {
    const current = await db.attachments.get(row.targetId);
    if (!current || current.deletedAt) return null;
    const blob = await StorageService.readBlob(current.id, current.localUri, current.mimeType);
    return blob ? { blob, name: current.name } : null;
  }
  const current = await db.audio_recordings.get(row.targetId);
  if (!current || current.deletedAt) return null;
  const blob = await StorageService.readBlob(current.id, current.localUri, current.mimeType);
  return blob ? { blob, name: `${current.id}.audio` } : null;
}

/**
 * Sem sessão ou sem nuvem devolve null e o arquivo continua aguardando.
 * Falha de envio com a nuvem configurada e sessão ativa sobe como exceção.
 */
export async function uploadLocalFile(row: FileTransfer): Promise<string | null> {
  if (!isRemoteConfigured()) return null;
  if (!(await hasRemoteSession())) return null;
  const client = await getSupabase();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!client || !session) return null;
  const source = await sourceBlob(row);
  if (!source) throw new Error('Arquivo local ausente.');
  if (fileTooLarge(source.blob.size)) throw new Error('Arquivo acima de 30 MB.');
  const path = `${session.user.id}/${row.target}/${row.targetId}`;
  const { error } = await client.storage.from(FILES_BUCKET).upload(path, source.blob, {
    upsert: true,
    contentType: source.blob.type || 'application/octet-stream',
  });
  if (error) throw new Error(error.message);
  return path;
}

async function stampQueuedPayload(entity: 'attachments' | 'audio_recordings', id: string, remotePath: string, updatedAt: string): Promise<boolean> {
  const pending = await db.sync_queue
    .filter((item) => item.entity === entity && item.entityId === id && item.deletedAt === null && item.status !== 'processing')
    .first();
  if (!pending) return false;
  const parsed = parseJson(pending.payload);
  if (!isRecord(parsed)) return false;
  const payload = JSON.stringify({ ...parsed, remotePath, updatedAt, syncStatus: 'pending' });
  await db.sync_queue.put({ ...pending, payload, updatedAt });
  return true;
}

async function markUploaded(row: FileTransfer, remotePath: string): Promise<void> {
  const updatedAt = nowIso();
  const entity = row.target === 'attachment' ? 'attachments' : 'audio_recordings';
  const processing = await db.sync_queue
    .filter((item) => item.entity === entity && item.entityId === row.targetId && item.status === 'processing' && item.deletedAt === null)
    .first();
  if (processing) throw new Error('A ficha ainda está sendo enviada.');
  if (row.target === 'attachment') {
    const current = await db.attachments.get(row.targetId);
    if (!current) return;
    const next = { ...current, remotePath, syncStatus: 'synced' as const, updatedAt };
    await db.attachments.put(next);
    const queued = await stampQueuedPayload(entity, row.targetId, remotePath, updatedAt);
    if (!queued) await supabaseGateway.upsertRecord(entity, next);
    return;
  }
  const current = await db.audio_recordings.get(row.targetId);
  if (!current) return;
  const next = { ...current, remotePath, syncStatus: 'synced' as const, updatedAt };
  await db.audio_recordings.put(next);
  const queued = await stampQueuedPayload(entity, row.targetId, remotePath, updatedAt);
  if (!queued) await supabaseGateway.upsertRecord(entity, next);
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
        const remotePath = await uploadLocalFile(row);
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

async function keepLocal(id: string, localUri: string | null, mimeType: string): Promise<boolean> {
  const blob = await StorageService.readBlob(id, localUri, mimeType);
  return Boolean(blob);
}

export async function pullMissingFiles(): Promise<void> {
  if (!isRemoteConfigured() || !(await hasRemoteSession())) return;
  const client = await getSupabase();
  const user = AuthService.current();
  if (!client || !user) return;
  const attachments = await db.attachments
    .filter((row) => row.userId === user.id && row.deletedAt === null && row.remotePath !== null)
    .toArray();
  for (const row of attachments) {
    if (!row.remotePath || (await keepLocal(row.id, row.localUri, row.mimeType))) continue;
    const { data, error } = await client.storage.from(FILES_BUCKET).download(row.remotePath);
    if (error || !data) continue;
    const localUri = await StorageService.writeBlob(row.id, data, row.name);
    await db.attachments.put({ ...row, localUri });
  }
  const clips = await db.audio_recordings
    .filter((row) => row.userId === user.id && row.deletedAt === null && row.remotePath !== null)
    .toArray();
  for (const row of clips) {
    if (!row.remotePath || (await keepLocal(row.id, row.localUri, row.mimeType))) continue;
    const { data, error } = await client.storage.from(FILES_BUCKET).download(row.remotePath);
    if (error || !data) continue;
    const localUri = await StorageService.writeBlob(row.id, data, `${row.id}.audio`);
    await db.audio_recordings.put({ ...row, localUri });
  }
}

export async function dropTransfer(targetId: string): Promise<void> {
  const existing = await db.file_queue.filter((row) => row.targetId === targetId).first();
  if (!existing) return;
  await db.file_queue.delete(existing.id);
  notify();
}
