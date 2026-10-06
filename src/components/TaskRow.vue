<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonActionSheet, IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/vue';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useNotesStore } from '@/stores/notesStore';
import { useTasksStore } from '@/stores/tasksStore';
import type { Task } from '@/types/entities';
import { todayKey } from '@/utils/dates';
import { displayTitle } from '@/utils/text';
import { taskSummary } from '@/utils/tasks';

const props = defineProps<{ task: Task }>();
const emit = defineEmits<{ edit: [id: string]; openNote: [id: string] }>();

const tasks = useTasksStore();
const collections = useCollectionsStore();
const notes = useNotesStore();
const sheet = ref(false);

const summary = computed(() => {
  const collectionName = props.task.collectionId
    ? (collections.items.find((item) => item.id === props.task.collectionId)?.name ?? null)
    : null;
  const note = props.task.noteId ? notes.notes.find((item) => item.id === props.task.noteId) : undefined;
  return taskSummary(props.task, todayKey(), collectionName, note ? displayTitle(note) : null);
});

const buttons = computed(() => {
  const noteId = props.task.noteId;
  return [
    { text: 'Editar', handler: () => emit('edit', props.task.id) },
    {
      text: props.task.done ? 'Reabrir' : 'Marcar como feita',
      handler: () => {
        void tasks.toggle(props.task.id);
      },
    },
    ...(noteId
      ? [{ text: 'Abrir nota', handler: () => emit('openNote', noteId) }]
      : []),
    {
      text: 'Excluir tarefa',
      role: 'destructive' as const,
      handler: () => {
        void tasks.remove(props.task.id);
      },
    },
    { text: 'Cancelar', role: 'cancel' as const },
  ];
});
</script>

<template>
  <div class="fn-row-host">
    <ion-item-sliding class="fn-slide">
      <ion-item lines="none" class="fn-slide-item">
        <div class="fn-task-line">
          <button
            type="button"
            class="fn-checkhit"
            :aria-pressed="task.done"
            :aria-label="task.done ? 'Marcar como pendente' : 'Marcar como feita'"
            @click="tasks.toggle(task.id)"
          >
            <i />
          </button>
          <button type="button" class="fn-task-copy" @click="emit('edit', task.id)">
            <strong :class="{ 'fn-task-done': task.done }">{{ task.title }}</strong>
            <small v-if="summary">{{ summary }}</small>
            <small v-else-if="task.detail">{{ task.detail }}</small>
          </button>
          <button type="button" class="fn-text-btn" :aria-label="`Ações de ${task.title}`" @click="sheet = true">
            Ações
          </button>
        </div>
      </ion-item>
      <ion-item-options side="end">
        <ion-item-option @click="emit('edit', task.id)">Editar</ion-item-option>
        <ion-item-option color="danger" @click="tasks.remove(task.id)">Excluir</ion-item-option>
      </ion-item-options>
    </ion-item-sliding>
    <ion-action-sheet :is-open="sheet" header="Tarefa" :buttons="buttons" @didDismiss="sheet = false" />
  </div>
</template>
