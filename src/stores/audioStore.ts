import { defineStore } from 'pinia';
import { ref } from 'vue';
import { AudioService } from '@/services/AudioService';
import { StorageService } from '@/services/StorageService';
import { useAuthStore } from '@/stores/authStore';
import { pushToast } from '@/composables/useToast';
import { db } from '@/database/db';
import { dropTransfer, enqueueTransfer, onTransfersChanged, retryTransfer } from '@/sync/fileQueue';
import type { AudioRecording, FileTransfer } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { fileTooLarge } from '@/utils/files';
import { createId } from '@/utils/id';

export const useAudioStore = defineStore('audioStore', () => {
  const items = ref<AudioRecording[]>([]);
  const transfers = ref<FileTransfer[]>([]);
  let unlistened = false;

  function forNote(noteId: string): AudioRecording[] {
    return items.value
      .filter((item) => item.noteId === noteId)
      .sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1));
  }

  function transferFor(id: string): FileTransfer | undefined {
    return transfers.value.find((item) => item.targetId === id);
  }

  async function reloadTransfers(): Promise<void> {
    const ids = new Set(items.value.map((item) => item.id));
    const rows = await db.file_queue.filter((row) => row.target === 'audio' && ids.has(row.targetId)).toArray();
    transfers.value = rows;
  }

  async function hydrate(): Promise<void> {
    const userId = useAuthStore().userId;
    if (!userId) return;
    items.value = await AudioService.list(userId);
    await reloadTransfers();
    if (!unlistened) {
      unlistened = true;
      onTransfersChanged(() => {
        void reloadTransfers();
      });
    }
  }

  async function addClip(noteId: string, blob: Blob, durationMs: number, mimeType: string): Promise<AudioRecording | null> {
    const userId = useAuthStore().userId;
    if (!userId || !noteId || blob.size === 0) return null;
    if (fileTooLarge(blob.size)) {
      pushToast('Arquivo grande demais para este aparelho.');
      return null;
    }
    const id = createId();
    const now = nowIso();
    let localUri: string;
    try {
      localUri = await StorageService.writeBlob(id, blob, `${id}.audio`);
    } catch {
      pushToast('Não foi possível salvar neste aparelho.');
      return null;
    }
    const recording: AudioRecording = {
      id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      userId,
      noteId,
      durationMs,
      mimeType: mimeType || blob.type || 'audio/webm',
      localUri,
      remotePath: null,
    };
    items.value = [...items.value, recording];
    try {
      await AudioService.persist(recording);
      const transfer = await enqueueTransfer('audio', id);
      transfers.value = [...transfers.value.filter((item) => item.targetId !== id), transfer];
      return recording;
    } catch {
      items.value = items.value.filter((item) => item.id !== id);
      pushToast('Não foi possível salvar neste aparelho.');
      return null;
    }
  }

  async function remove(id: string): Promise<void> {
    const current = items.value.find((item) => item.id === id);
    if (!current) return;
    const next: AudioRecording = { ...current, deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' };
    items.value = items.value.filter((item) => item.id !== id);
    try {
      await AudioService.persist(next);
      await StorageService.removeBlob(id, current.localUri);
      await dropTransfer(id);
      transfers.value = transfers.value.filter((item) => item.targetId !== id);
    } catch {
      items.value = [...items.value, current];
      pushToast('Não foi possível salvar neste aparelho.');
    }
  }

  async function retry(id: string): Promise<void> {
    const next = await retryTransfer(id);
    if (!next) return;
    transfers.value = [...transfers.value.filter((item) => item.targetId !== id), next];
  }

  async function clipUrl(item: AudioRecording): Promise<string | null> {
    const blob = await StorageService.readBlob(item.id, item.localUri, item.mimeType);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }

  return { items, transfers, forNote, transferFor, hydrate, addClip, remove, retry, clipUrl };
});