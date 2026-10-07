<script setup lang="ts">
import type { TransferStatus } from '@/types/entities';
import { transferText } from '@/sync/fileQueue';

defineProps<{ status: TransferStatus }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <p v-if="status === 'sincronizando' || status === 'erro'" class="fn-transfer" :data-status="status">
    <span>{{ transferText(status) }}</span>
    <button v-if="status === 'erro'" type="button" class="fn-text-btn" @click="emit('retry')">Tentar de novo</button>
  </p>
</template>
