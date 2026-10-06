import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { CollectionService } from '@/services/CollectionService';
import { useAuthStore } from '@/stores/authStore';
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

  async function add(name: string): Promise<void> {
    const userId = useAuthStore().userId;
    const trimmed = name.trim();
    if (!userId || !trimmed) return;
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
    } catch {
      items.value = items.value.filter((item) => item.id !== collection.id);
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
    }
  }

  return { items, ordered, hydrate, add, remove };
});
