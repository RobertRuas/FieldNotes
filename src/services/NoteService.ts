import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import type { Note } from '@/types/entities';
import { isDateKey } from '@/utils/dates';
import { clearEditorBackup, readEditorBackup } from '@/utils/editorBackup';
import { sanitizeNoteHtml } from '@/utils/html';
import { hasVisibleContent } from '@/utils/text';

function cleanNote(note: Note): Note {
  return {
    ...note,
    title: note.title.trim().slice(0, 200),
    text: sanitizeNoteHtml(note.text).slice(0, 200_000),
    syncStatus: 'pending',
  };
}

export const NoteService = {
  async list(userId: string): Promise<Note[]> {
    return db.notes.filter((row) => row.userId === userId && row.deletedAt === null).toArray();
  },

  async get(id: string): Promise<Note | undefined> {
    const row = await db.notes.get(id);
    if (!row || row.deletedAt) return undefined;
    return row;
  },

  async persist(note: Note): Promise<void> {
    const clean = cleanNote(note);
    await enqueueWrite(db.notes, 'notes', clean, clean.deletedAt ? 'delete' : 'upsert');
  },

  // Se o app fechar no meio da digitação, a cópia local entra no IndexedDB na próxima abertura.
  async restorePending(userId: string): Promise<void> {
    const pending = readEditorBackup();
    if (!pending || pending.userId !== userId) return;
    if (!isDateKey(pending.date)) {
      clearEditorBackup(pending.id);
      return;
    }
    if (!hasVisibleContent(pending.title, pending.text) && !pending.collectionId && !pending.reminderAt) {
      clearEditorBackup(pending.id);
      return;
    }
    const existing = await db.notes.get(pending.id);
    if (existing?.deletedAt) {
      clearEditorBackup(pending.id);
      return;
    }
    if (existing && existing.updatedAt >= pending.updatedAt) {
      clearEditorBackup(pending.id);
      return;
    }
    const note: Note = existing
      ? {
          ...existing,
          title: pending.title,
          text: pending.text,
          date: pending.date,
          collectionId: pending.collectionId,
          reminderAt: pending.reminderAt,
          updatedAt: pending.updatedAt,
          syncStatus: 'pending',
        }
      : {
          id: pending.id,
          createdAt: pending.updatedAt,
          updatedAt: pending.updatedAt,
          deletedAt: null,
          syncStatus: 'pending',
          userId,
          title: pending.title,
          text: pending.text,
          attachments: [],
          photos: [],
          documents: [],
          audio: [],
          tasks: [],
          date: pending.date,
          collectionId: pending.collectionId,
          reminderAt: pending.reminderAt,
        };
    await enqueueWrite(db.notes, 'notes', cleanNote(note), 'upsert');
    clearEditorBackup(pending.id);
  },
};
