<script setup lang="ts">
import { inject, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { ellipsisHorizontal } from 'ionicons/icons';
import { editorKey, type EditorCommand } from '@/composables/editorContext';

const emit = defineEmits<{
  command: [command: EditorCommand];
  link: [];
}>();

const editor = inject(editorKey, null);
const more = ref(false);

function toggleMore(): void {
  more.value = !more.value;
  editor?.value?.focus();
}

const primary: { command: EditorCommand; label: string; text: string; style?: string }[] = [
  { command: 'bold', label: 'Negrito', text: 'B' },
  { command: 'italic', label: 'Itálico', text: 'I', style: 'serif' },
  { command: 'underline', label: 'Sublinhado', text: 'U', style: 'underline' },
];

const extra: { command: EditorCommand; label: string; text: string }[] = [
  { command: 'bullet', label: 'Lista', text: '•' },
  { command: 'ordered', label: 'Lista numerada', text: '1.' },
  { command: 'check', label: 'Adicionar tarefa', text: '☑' },
];

function hold(event: MouseEvent): void {
  const target = event.target;
  if (target instanceof Element && target.closest('[data-picker]')) return;
  event.preventDefault();
}
</script>

<template>
  <div class="fn-dock-stack" @mousedown="hold">
    <div v-if="more" class="fn-dock-extra">
      <button
        v-for="tool in extra"
        :key="tool.command"
        type="button"
        class="fn-tool"
        :aria-label="tool.label"
        @click="emit('command', tool.command)"
      >
        {{ tool.text }}
      </button>
      <button type="button" class="fn-tool fn-tool-link" aria-label="Link" @click="emit('link')">Link</button>
    </div>
    <div class="fn-dock-main">
      <div class="fn-tools">
        <button
          v-for="tool in primary"
          :key="tool.command"
          type="button"
          class="fn-tool"
          :data-style="tool.style"
          :aria-label="tool.label"
          @click="emit('command', tool.command)"
        >
          {{ tool.text }}
        </button>
        <button
          type="button"
          class="fn-tool"
          :aria-expanded="more"
          :aria-label="more ? 'Ocultar formatação' : 'Mais formatação'"
          @click="toggleMore"
        >
          <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
        </button>
      </div>
      <div class="fn-dock-actions">
        <slot />
      </div>
    </div>
  </div>
</template>
