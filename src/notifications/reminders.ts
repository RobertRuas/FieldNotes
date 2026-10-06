import type { Note, Notification } from '@/types/entities';
import { displayTitle } from '@/utils/text';

export function buildReminderNotification(note: Note, id: string, createdAt: string): Notification {
  return {
    id,
    createdAt,
    updatedAt: note.updatedAt,
    deletedAt: null,
    syncStatus: 'pending',
    userId: note.userId,
    kind: 'reminder',
    title: displayTitle(note),
    body: 'Lembrete da nota',
    readAt: null,
    noteId: note.id,
    fireAt: note.reminderAt,
  };
}
