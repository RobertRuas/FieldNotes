<script setup lang="ts">
defineProps<{ text: string }>();
</script>

<template>
  <pre class="fn-template-preview">{{ text }}</pre>
</template>

<style scoped>
.fn-template-preview {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--fn-font-note);
  font-size: 15px;
  line-height: 1.45;
  color: var(--fn-ink);
}
</style>
