<script setup lang="ts">
import { computed } from 'vue';
import { useSyncStore } from '@/stores/syncStore';

const sync = useSyncStore();
const phase = computed(() => sync.phase);
const label = computed(() => sync.label);
</script>

<template>
  <p class="fn-sync" :data-phase="phase" aria-live="polite">{{ label }}</p>
</template>
