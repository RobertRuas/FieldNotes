import { db } from '@/database/db';
import { buildReminderNotification } from '@/notifications/reminders';
import { cancelReminder, scheduleReminder } from '@/notifications/scheduler';
import { enqueueWrite } from '@/sync/queue';
import type { Note, Notification, Task } from '@/types/entities';
import { createId } from '@/utils/id';
import { nowIso } from '@/utils/dates';
import { displayTitle } from '@/utils/text';

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
    const alarmId = `note:${note.id}`;
    if (!note.reminderAt || note.deletedAt) {
      await cancelReminder(alarmId);
      if (!existing) return;
      await this.persist({ ...existing, deletedAt: nowIso(), updatedAt: nowIso() });
      return;
    }
    await scheduleReminder({
      id: alarmId,
      title: displayTitle(note),
      body: 'Lembrete da nota',
      fireAt: note.reminderAt,
      ask: true,
    });
    if (existing && existing.fireAt === note.reminderAt) return;
    const notification = buildReminderNotification(note, existing?.id ?? createId(), existing?.createdAt ?? note.updatedAt);
    await this.persist(notification);
  },

  async syncTaskReminder(task: Task): Promise<void> {
    const alarmId = `task:${task.id}`;
    if (task.deletedAt || task.done || !task.reminderAt) {
      await cancelReminder(alarmId);
      return;
    }
    await scheduleReminder({
      id: alarmId,
      title: task.title,
      body: 'Lembrete da tarefa',
      fireAt: task.reminderAt,
      ask: true,
    });
  },
};
