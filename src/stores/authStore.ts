import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { AuthService } from '@/services/AuthService';
import type { User } from '@/types/entities';

export const useAuthStore = defineStore('authStore', () => {
  const user = ref<User | null>(null);
  const userId = computed(() => user.value?.id ?? null);

  async function hydrate(): Promise<void> {
    user.value = await AuthService.ensureLocalUser();
  }

  return { user, userId, hydrate };
});
