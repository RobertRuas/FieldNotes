import { defineStore } from 'pinia';
import { ref } from 'vue';
import { NotificationService } from '@/services/NotificationService';
import { useAuthStore } from '@/stores/authStore';
import type { Notification } from '@/types/entities';

export const useNotificationStore = defineStore('notificationStore', () => {
  const items = ref<Notification[]>([]);

  async function hydrate(): Promise<void> {
    const userId = useAuthStore().userId;
    if (!userId) return;
    items.value = await NotificationService.list(userId);
  }

  return { items, hydrate };
});
