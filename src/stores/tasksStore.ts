import { defineStore } from 'pinia';
import { ref } from 'vue';
import { NotificationService } from '@/services/NotificationService';
import { hapticLight } from '@/services/platform/haptics';
import { TaskService } from '@/services/TaskService';
import { useAuthStore } from '@/stores/authStore';
import { useNotesStore } from '@/stores/notesStore';
import type { Task, TaskPriority } from '@/types/entities';
import { pushToast } from '@/composables/useToast';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';
import { normalizeTask } from '@/utils/tasks';

export interface NewTask {
  title: string;
  detail?: string;
  noteId?: string | null;
  collectionId?: string | null;
  date?: string | null;
  time?: string | null;
  priority?: TaskPriority | null;
  reminderAt?: string | null;
}

export const useTasksStore = defineStore('tasksStore', () => {
  const tasks = ref<Task[]>([]);

  function forNote(noteId: string): Task[] {
    return tasks.value
      .filter((task) => task.noteId === noteId)
      .sort((left, right) => {
        if (left.done !== right.done) return left.done ? 1 : -1;
        return left.createdAt < right.createdAt ? -1 : 1;
      });
  }

  async function hydrate(): Promise<void> {
    const userId = useAuthStore().userId;
    if (!userId) return;
    tasks.value = await TaskService.list(userId);
  }

  async function add(input: NewTask): Promise<Task | null> {
    const userId = useAuthStore().userId;
    const title = input.title.trim();
    if (!userId || !title) return null;
    const now = nowIso();
    const task = normalizeTask({
      id: createId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      userId,
      noteId: input.noteId ?? null,
      collectionId: input.collectionId ?? null,
      title,
      detail: input.detail ?? '',
      done: false,
      date: input.date ?? null,
      time: input.time ?? null,
      priority: input.priority ?? null,
      reminderAt: input.reminderAt ?? null,
      dueAt: null,
    });
    tasks.value.unshift(task);
    try {
      await TaskService.persist(task);
      await NotificationService.syncTaskReminder(task);
      return task;
    } catch {
      tasks.value = tasks.value.filter((item) => item.id !== task.id);
      pushToast('Não foi possível salvar neste aparelho.');
      return null;
    }
  }

  async function save(task: Task, quiet = false): Promise<void> {
    const next = normalizeTask({ ...task, updatedAt: nowIso(), syncStatus: 'pending' });
    const index = tasks.value.findIndex((item) => item.id === next.id);
    const previous = index >= 0 ? tasks.value[index] : undefined;
    if (index === -1) tasks.value.unshift(next);
    else tasks.value[index] = next;
    try {
      await TaskService.persist(next);
      await NotificationService.syncTaskReminder(next);
    } catch {
      if (previous) {
        const at = tasks.value.findIndex((item) => item.id === next.id);
        if (at === -1) tasks.value.unshift(previous);
        else tasks.value[at] = previous;
      } else {
        tasks.value = tasks.value.filter((item) => item.id !== next.id);
      }
      if (!quiet) pushToast('Não foi possível salvar neste aparelho.');
      throw new Error('falha-local');
    }
  }

  async function toggle(id: string): Promise<void> {
    const current = tasks.value.find((item) => item.id === id);
    if (!current) return;
    const next = normalizeTask({ ...current, done: !current.done, updatedAt: nowIso(), syncStatus: 'pending' });
    if (next.done) {
      try {
        await hapticLight();
      } catch {
        // Sem vibração neste aparelho a conclusão continua local.
      }
    }
    const index = tasks.value.findIndex((item) => item.id === id);
    if (index >= 0) tasks.value[index] = next;
    try {
      await TaskService.persist(next);
      await NotificationService.syncTaskReminder(next);
    } catch {
      if (index >= 0) tasks.value[index] = current;
      pushToast('Não foi possível salvar neste aparelho.');
    }
  }

  async function remove(id: string, unlinkNote = true): Promise<void> {
    const current = tasks.value.find((item) => item.id === id);
    if (!current) return;
    const next = normalizeTask({ ...current, deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' });
    tasks.value = tasks.value.filter((item) => item.id !== id);
    try {
      await TaskService.persist(next);
      await NotificationService.syncTaskReminder(next);
    } catch {
      tasks.value.unshift(current);
      pushToast('Não foi possível salvar neste aparelho.');
      return;
    }
    if (!unlinkNote || !current.noteId) return;
    const notes = useNotesStore();
    const note = notes.notes.find((item) => item.id === current.noteId);
    if (!note || !note.tasks.includes(id)) return;
    try {
      await notes.save(
        { ...note, tasks: note.tasks.filter((taskId) => taskId !== id), updatedAt: nowIso(), syncStatus: 'pending' },
        true,
      );
    } catch {
      pushToast('A tarefa saiu, mas o vínculo com a nota não foi atualizado.');
    }
  }

  return { tasks, forNote, hydrate, add, save, toggle, remove };
});
