<script setup lang="ts">
import type { TransferStatus } from '@/types/entities';
import { transferText } from '@/sync/fileQueue';

defineProps<{ status: TransferStatus }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <p class="fn-transfer" :data-status="status">
    <span>{{ transferText(status) }}</span>
    <span v-if="status === 'aguardando'"> · Salvo neste dispositivo</span>
    <button v-if="status === 'erro'" type="button" class="fn-text-btn" @click="emit('retry')">Tentar de novo</button>
  </p>
</template>
