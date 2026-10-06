import { db } from '@/database/db';
import { buildReminderNotification } from '@/notifications/reminders';
import { pushIntegrationReady } from '@/services/platform/push';
import { enqueueWrite } from '@/sync/queue';
import type { Note, Notification } from '@/types/entities';
import { createId } from '@/utils/id';
import { nowIso } from '@/utils/dates';

export const NotificationService = {
  async list(userId: string): Promise<Notification[]> {
    return db.notifications.filter((row) => row.userId === userId && row.deletedAt === null).toArray();
  },

  async persist(notification: Notification): Promise<void> {
    await enqueueWrite(
      db.notifications,
      'notifications',
      { ...notification, syncStatus: 'pending' },
      notification.deletedAt ? 'delete' : 'upsert',
    );
  },

  async syncReminder(note: Note): Promise<void> {
    const existing = await db.notifications
      .filter((row) => row.noteId === note.id && row.kind === 'reminder' && row.deletedAt === null)
      .first();
    if (!note.reminderAt || note.deletedAt) {
      if (!existing) return;
      await this.persist({ ...existing, deletedAt: nowIso(), updatedAt: nowIso() });
      return;
    }
    if (existing && existing.fireAt === note.reminderAt) return;
    const notification = buildReminderNotification(note, existing?.id ?? createId(), existing?.createdAt ?? note.updatedAt);
    await this.persist(notification);
  },

  // Não pede permissão de push nesta fase.
  preparePush(): 'deferred' | 'unsupported' {
    return pushIntegrationReady() ? 'deferred' : 'unsupported';
  },
};
