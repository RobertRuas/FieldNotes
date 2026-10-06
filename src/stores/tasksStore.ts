import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { TaskService } from '@/services/TaskService';
import { useAuthStore } from '@/stores/authStore';
import type { Task } from '@/types/entities';
import { pushToast } from '@/composables/useToast';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';

export const useTasksStore = defineStore('tasksStore', () => {
  const tasks = ref<Task[]>([]);
  const ordered = computed(() =>
    [...tasks.value].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    }),
  );

  async function hydrate(): Promise<void> {
    const userId = useAuthStore().userId;
    if (!userId) return;
    tasks.value = await TaskService.list(userId);
  }

  async function add(title: string, detail: string): Promise<void> {
    const userId = useAuthStore().userId;
    const trimmed = title.trim();
    if (!userId || !trimmed) return;
    const now = nowIso();
    const task: Task = {
      id: createId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      userId,
      noteId: null,
      title: trimmed,
      detail: detail.trim(),
      done: false,
      dueAt: null,
    };
    tasks.value.unshift(task);
    try {
      await TaskService.persist(task);
    } catch {
      tasks.value = tasks.value.filter((item) => item.id !== task.id);
      pushToast('Não foi possível salvar neste aparelho.');
    }
  }

  async function toggle(id: string): Promise<void> {
    const current = tasks.value.find((item) => item.id === id);
    if (!current) return;
    const next: Task = { ...current, done: !current.done, updatedAt: nowIso(), syncStatus: 'pending' };
    await replace(next, current);
  }

  async function remove(id: string): Promise<void> {
    const current = tasks.value.find((item) => item.id === id);
    if (!current) return;
    const next: Task = { ...current, deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' };
    tasks.value = tasks.value.filter((item) => item.id !== id);
    try {
      await TaskService.persist(next);
    } catch {
      tasks.value.unshift(current);
      pushToast('Não foi possível salvar neste aparelho.');
    }
  }

  async function replace(next: Task, previous: Task): Promise<void> {
    const index = tasks.value.findIndex((item) => item.id === next.id);
    if (index >= 0) tasks.value[index] = next;
    try {
      await TaskService.persist(next);
    } catch {
      if (index >= 0) tasks.value[index] = previous;
      pushToast('Não foi possível salvar neste aparelho.');
    }
  }

  return { tasks, ordered, hydrate, add, toggle, remove };
});
