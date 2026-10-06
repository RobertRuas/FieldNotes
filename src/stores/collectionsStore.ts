import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { CollectionService } from '@/services/CollectionService';
import { useAuthStore } from '@/stores/authStore';
import { useNotesStore } from '@/stores/notesStore';
import { useTasksStore } from '@/stores/tasksStore';
import type { Collection } from '@/types/entities';
import { pushToast } from '@/composables/useToast';
import { nextCollectionColor } from '@/utils/colors';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';

export const useCollectionsStore = defineStore('collectionsStore', () => {
  const items = ref<Collection[]>([]);
  const ordered = computed(() => [...items.value].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));

  async function hydrate(): Promise<void> {
    const userId = useAuthStore().userId;
    if (!userId) return;
    items.value = await CollectionService.list(userId);
  }

  async function add(name: string): Promise<Collection | null> {
    const userId = useAuthStore().userId;
    const trimmed = name.trim();
    if (!userId || !trimmed) return null;
    const now = nowIso();
    const collection: Collection = {
      id: createId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      userId,
      name: trimmed,
      color: nextCollectionColor(items.value.length),
    };
    items.value.unshift(collection);
    try {
      await CollectionService.persist(collection);
      return collection;
    } catch {
      items.value = items.value.filter((item) => item.id !== collection.id);
      pushToast('Não foi possível salvar neste aparelho.');
      return null;
    }
  }

  async function rename(id: string, name: string): Promise<void> {
    const current = items.value.find((item) => item.id === id);
    const trimmed = name.trim();
    if (!current || !trimmed || trimmed === current.name) return;
    const next: Collection = { ...current, name: trimmed, updatedAt: nowIso(), syncStatus: 'pending' };
    const index = items.value.findIndex((item) => item.id === id);
    if (index >= 0) items.value[index] = next;
    try {
      await CollectionService.persist(next);
    } catch {
      if (index >= 0) items.value[index] = current;
      pushToast('Não foi possível salvar neste aparelho.');
    }
  }

  async function remove(id: string): Promise<void> {
    const current = items.value.find((item) => item.id === id);
    if (!current) return;
    const next: Collection = { ...current, deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' };
    items.value = items.value.filter((item) => item.id !== id);
    try {
      await CollectionService.persist(next);
    } catch {
      items.value.unshift(current);
      pushToast('Não foi possível salvar neste aparelho.');
      return;
    }
    await detach(id);
  }

  return { items, ordered, hydrate, add, rename, remove };
});

async function detach(id: string): Promise<void> {
  // A coleção some; notas e tarefas continuam, só sem esse vínculo.
  const now = nowIso();
  const notes = useNotesStore();
  let failed = false;
  for (const note of [...notes.notes]) {
    if (note.collectionId !== id) continue;
    try {
      await notes.save({ ...note, collectionId: null, updatedAt: now, syncStatus: 'pending' }, true);
    } catch {
      failed = true;
    }
  }
  const tasks = useTasksStore();
  for (const task of [...tasks.tasks]) {
    if (task.collectionId !== id) continue;
    try {
      await tasks.save({ ...task, collectionId: null }, true);
    } catch {
      failed = true;
    }
  }
  if (failed) pushToast('A coleção saiu, mas nem todo vínculo foi atualizado.');
}
