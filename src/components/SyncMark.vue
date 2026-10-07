<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { cloudDoneOutline, cloudOfflineOutline } from 'ionicons/icons';
import type { SyncStatus } from '@/types/entities';

const props = defineProps<{ status: SyncStatus }>();

const synced = computed(() => props.status === 'synced');
const failed = computed(() => props.status === 'error' || props.status === 'conflict');
const label = computed(() => {
  if (synced.value) return 'Sincronizada';
  if (failed.value) return 'Falha ao sincronizar';
  return 'Ainda não sincronizada';
});
</script>

<template>
  <ion-icon
    class="fn-sync-mark"
    :class="{ 'is-synced': synced, 'is-error': failed }"
    :icon="synced ? cloudDoneOutline : cloudOfflineOutline"
    :aria-label="label"
  />
</template>
