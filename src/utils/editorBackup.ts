import { isRecord } from '@/utils/guards';
import { parseJson } from '@/utils/json';

const KEY = 'fieldnotes.pendingNote';

export interface PendingNote {
  id: string;
  userId: string;
  title: string;
  text: string;
  date: string;
  collectionId: string | null;
  reminderAt: string | null;
  updatedAt: string;
}

function readPending(value: unknown): PendingNote | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.userId !== 'string') return null;
  if (typeof value.title !== 'string' || typeof value.text !== 'string') return null;
  if (typeof value.date !== 'string' || typeof value.updatedAt !== 'string') return null;
  if (!(value.collectionId === null || typeof value.collectionId === 'string')) return null;
  if (!(value.reminderAt === null || typeof value.reminderAt === 'string')) return null;
  return {
    id: value.id,
    userId: value.userId,
    title: value.title,
    text: value.text,
    date: value.date,
    collectionId: value.collectionId,
    reminderAt: value.reminderAt,
    updatedAt: value.updatedAt,
  };
}

export function readEditorBackup(): PendingNote | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return readPending(parseJson(raw));
  } catch {
    return null;
  }
}

export function writeEditorBackup(note: PendingNote): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(note));
  } catch {
    // A gravação principal segue no IndexedDB.
  }
}

export function clearEditorBackup(id?: string): void {
  try {
    if (!id) {
      localStorage.removeItem(KEY);
      return;
    }
    const current = readEditorBackup();
    if (!current || current.id === id) localStorage.removeItem(KEY);
  } catch {
    // Ignora falha de armazenamento auxiliar.
  }
}
