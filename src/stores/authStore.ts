import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { AuthService, type AuthResult } from '@/services/AuthService';
import { getSupabase } from '@/services/supabaseClient';
import type { User } from '@/types/entities';
import { isRemoteConfigured } from '@/utils/env';

export const useAuthStore = defineStore('authStore', () => {
  const user = ref<User | null>(null);
  const accountEmail = ref<string | null>(null);
  const userId = computed(() => user.value?.id ?? null);
  const remoteConfigured = computed(() => isRemoteConfigured());
  const signedIn = computed(() => accountEmail.value !== null);

  async function readSession(): Promise<void> {
    const client = await getSupabase();
    if (!client) {
      accountEmail.value = null;
      return;
    }
    const { data } = await client.auth.getSession();
    accountEmail.value = data.session?.user.email ?? null;
  }

  async function hydrate(): Promise<void> {
    user.value = await AuthService.ensureLocalUser();
    const restored = await AuthService.restoreSession();
    if (restored?.ok) user.value = restored.user;
    await readSession();
  }

  async function apply(result: AuthResult): Promise<AuthResult> {
    if (result.ok) user.value = result.user;
    await readSession();
    return result;
  }

  function signIn(email: string, password: string): Promise<AuthResult> {
    return AuthService.signIn(email, password).then(apply);
  }

  function signUp(email: string, password: string, displayName: string): Promise<AuthResult> {
    return AuthService.signUp(email, password, displayName).then(apply);
  }

  function signOut(): Promise<AuthResult> {
    return AuthService.signOut().then(apply);
  }

  return { user, accountEmail, userId, remoteConfigured, signedIn, hydrate, signIn, signUp, signOut };
});
