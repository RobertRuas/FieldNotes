import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import type { Task } from '@/types/entities';
import { normalizeTask } from '@/utils/tasks';

export const TaskService = {
  async list(userId: string): Promise<Task[]> {
    const rows = await db.tasks.filter((row) => row.userId === userId && row.deletedAt === null).toArray();
    return rows.map((row) => normalizeTask(row));
  },

  async persist(task: Task): Promise<void> {
    const next = normalizeTask({
      ...task,
      title: task.title.trim().slice(0, 200),
      detail: task.detail.trim().slice(0, 2000),
      syncStatus: 'pending',
    });
    if (!next.title) return;
    await enqueueWrite(db.tasks, 'tasks', next, next.deletedAt ? 'delete' : 'upsert');
  },
};
