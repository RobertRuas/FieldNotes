import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import type { Task } from '@/types/entities';

export const TaskService = {
  async list(userId: string): Promise<Task[]> {
    return db.tasks.filter((row) => row.userId === userId && row.deletedAt === null).toArray();
  },

  async persist(task: Task): Promise<void> {
    const next: Task = {
      ...task,
      title: task.title.trim().slice(0, 200),
      detail: task.detail.trim().slice(0, 2000),
      syncStatus: 'pending',
    };
    await enqueueWrite(db.tasks, 'tasks', next, next.deletedAt ? 'delete' : 'upsert');
  },
};
