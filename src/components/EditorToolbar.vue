<script setup lang="ts">
import type { EditorCommand } from '@/composables/editorContext';

const emit = defineEmits<{
  command: [command: EditorCommand];
  link: [];
}>();

const tools: { command: EditorCommand; label: string; text: string; serif?: boolean }[] = [
  { command: 'bold', label: 'Negrito', text: 'B' },
  { command: 'italic', label: 'Itálico', text: 'I', serif: true },
  { command: 'bullet', label: 'Lista', text: '•' },
  { command: 'ordered', label: 'Lista numerada', text: '1.' },
  { command: 'check', label: 'Adicionar tarefa', text: '☑' },
];

function hold(event: PointerEvent): void {
  event.preventDefault();
}
</script>

<template>
  <div class="fn-tools" @pointerdown="hold">
    <button
      v-for="tool in tools"
      :key="tool.command"
      type="button"
      class="fn-tool"
      :data-style="tool.serif ? 'serif' : undefined"
      :aria-label="tool.label"
      @click="emit('command', tool.command)"
    >
      {{ tool.text }}
    </button>
    <button type="button" class="fn-tool" aria-label="Link" @click="emit('link')">Link</button>
  </div>
</template>
