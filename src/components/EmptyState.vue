<script setup lang="ts">
defineProps<{
  title: string;
  body?: string;
}>();
</script>

<template>
  <div class="fn-empty">
    <strong>{{ title }}</strong>
    <p v-if="body">{{ body }}</p>
    <slot />
  </div>
</template>
