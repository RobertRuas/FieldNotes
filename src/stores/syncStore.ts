import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { SyncService, type SyncSnapshot } from '@/services/SyncService';
import { phaseFor, phaseLabel, type SyncPhase } from '@/sync/engine';
import { pushToast } from '@/composables/useToast';
import { isRemoteConfigured } from '@/utils/env';

export const useSyncStore = defineStore('syncStore', () => {
  const phase = ref<SyncPhase>(typeof navigator === 'undefined' || navigator.onLine ? 'synced' : 'offline');
  const pending = ref(0);
  const lastError = ref<string | null>(null);
  const remoteConfigured = ref(isRemoteConfigured());
  const bootError = ref<string | null>(null);
  const label = computed(() => phaseLabel(phase.value));
  let listening = false;
  let sawSnapshot = false;

  function apply(snapshot: SyncSnapshot): void {
    const next = phaseFor(snapshot);
    if (sawSnapshot && phase.value !== 'offline' && next === 'offline') {
      pushToast(phaseLabel('offline'));
    }
    sawSnapshot = true;
    phase.value = next;
    pending.value = snapshot.pending;
    lastError.value = snapshot.lastError;
    remoteConfigured.value = snapshot.remoteConfigured;
  }

  function listen(): void {
    if (listening) return;
    listening = true;
    SyncService.subscribe(apply);
  }

  function setBootError(message: string): void {
    bootError.value = message;
  }

  return { phase, pending, lastError, remoteConfigured, bootError, label, listen, setBootError };
});
