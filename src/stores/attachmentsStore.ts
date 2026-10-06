import { defineStore } from 'pinia';
import { ref } from 'vue';
import { AttachmentService } from '@/services/AttachmentService';
import { captureNativePhoto, type PhotoSource } from '@/services/platform/camera';
import { StorageService } from '@/services/StorageService';
import { useAuthStore } from '@/stores/authStore';
import { pushToast } from '@/composables/useToast';
import { dropTransfer, enqueueTransfer, onTransfersChanged, retryTransfer } from '@/sync/fileQueue';
import { db } from '@/database/db';
import type { Attachment, AttachmentKind, FileTransfer } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { fileTooLarge, kindForDocument, thumbnailFor } from '@/utils/files';
import { createId } from '@/utils/id';

export const useAttachmentsStore = defineStore('attachmentsStore', () => {
  const items = ref<Attachment[]>([]);
  const transfers = ref<FileTransfer[]>([]);
  let unlistened = false;

  function forNote(noteId: string): Attachment[] {
    return items.value
      .filter((item) => item.noteId === noteId)
      .sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1));
  }

  function transferFor(id: string): FileTransfer | undefined {
    return transfers.value.find((item) => item.targetId === id);
  }

  async function reloadTransfers(): Promise<void> {
    const ids = new Set(items.value.map((item) => item.id));
    const rows = await db.file_queue.filter((row) => row.target === 'attachment' && ids.has(row.targetId)).toArray();
    transfers.value = rows;
  }

  async function hydrate(): Promise<void> {
    const userId = useAuthStore().userId;
    if (!userId) return;
    items.value = await AttachmentService.list(userId);
    await reloadTransfers();
    if (!unlistened) {
      unlistened = true;
      onTransfersChanged(() => {
        void reloadTransfers();
      });
    }
  }

  async function addFile(noteId: string, file: File, kind: AttachmentKind): Promise<Attachment | null> {
    const userId = useAuthStore().userId;
    if (!userId || !noteId) return null;
    if (fileTooLarge(file.size)) {
      pushToast('Arquivo grande demais para este aparelho.');
      return null;
    }
    const id = createId();
    const now = nowIso();
    let localUri: string;
    let thumbnail: string | null = null;
    try {
      thumbnail = await thumbnailFor(file);
      localUri = await StorageService.writeBlob(id, file, file.name || id);
    } catch {
      pushToast('Não foi possível salvar neste aparelho.');
      return null;
    }
    const attachment: Attachment = {
      id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      userId,
      noteId,
      kind,
      name: (file.name || 'arquivo').slice(0, 180),
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      localUri,
      remotePath: null,
      thumbnail,
    };
    items.value = [...items.value, attachment];
    try {
      await AttachmentService.persist(attachment);
      const transfer = await enqueueTransfer('attachment', id);
      transfers.value = [...transfers.value.filter((item) => item.targetId !== id), transfer];
      return attachment;
    } catch {
      items.value = items.value.filter((item) => item.id !== id);
      pushToast('Não foi possível salvar neste aparelho.');
      return null;
    }
  }

  async function addPhoto(noteId: string, file: File): Promise<Attachment | null> {
    return addFile(noteId, file, 'photo');
  }

  async function addFromNative(noteId: string, source: PhotoSource): Promise<Attachment | null> {
    const blob = await captureNativePhoto(source);
    if (!blob) return null;
    const name = source === 'camera' ? `foto-${Date.now()}.jpeg` : `imagem-${Date.now()}.jpeg`;
    const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
    return addPhoto(noteId, file);
  }

  async function addDocument(noteId: string, file: File): Promise<Attachment | null> {
    return addFile(noteId, file, kindForDocument(file));
  }

  async function remove(id: string): Promise<void> {
    const current = items.value.find((item) => item.id === id);
    if (!current) return;
    const next: Attachment = { ...current, deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' };
    items.value = items.value.filter((item) => item.id !== id);
    try {
      await AttachmentService.persist(next);
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

  async function originalUrl(item: Attachment): Promise<string | null> {
    const blob = await StorageService.readBlob(item.id, item.localUri, item.mimeType);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }

  return { items, transfers, forNote, transferFor, hydrate, addPhoto, addFromNative, addDocument, remove, retry, originalUrl };
});
