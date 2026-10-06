<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonButton, IonInput, IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/vue';
import { useTasksStore } from '@/stores/tasksStore';
import { readIonText } from '@/utils/ionic';

const props = defineProps<{
  noteId: string;
  collectionId: string | null;
  date: string;
}>();

const emit = defineEmits<{ changed: [] }>();
const tasks = useTasksStore();
const draft = ref('');
const field = ref<unknown>(null);
const section = ref<HTMLElement | null>(null);

const items = computed(() => tasks.forNote(props.noteId));

function onDraft(event: Event): void {
  draft.value = readIonText(event);
}

async function add(): Promise<void> {
  const created = await tasks.add({
    title: draft.value,
    noteId: props.noteId,
    collectionId: props.collectionId,
    date: props.date,
  });
  if (!created) return;
  draft.value = '';
  emit('changed');
}

async function remove(id: string): Promise<void> {
  await tasks.remove(id, false);
  emit('changed');
}

function focusable(value: unknown): { setFocus: () => Promise<void> } | null {
  if (!value || typeof value !== 'object' || !('setFocus' in value)) return null;
  const method = value.setFocus;
  if (typeof method !== 'function') return null;
  return {
    setFocus: () => Promise.resolve((method as () => Promise<void> | void).call(value)),
  };
}

async function focusNew(): Promise<void> {
  section.value?.scrollIntoView({ block: 'nearest' });
  await focusable(field.value)?.setFocus();
}

defineExpose({ focusNew });
</script>

<template>
  <section ref="section" class="fn-note-tasks" aria-label="Tarefas da nota">
    <h2>Tarefas</h2>
    <div v-if="items.length === 0" class="fn-muted">Nenhuma tarefa nesta nota.</div>
    <div v-else class="fn-task-stack">
      <div v-for="task in items" :key="task.id" class="fn-row-host">
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
              <span :class="{ 'fn-task-done': task.done }">{{ task.title }}</span>
              <button type="button" class="fn-text-btn" :aria-label="`Excluir ${task.title}`" @click="remove(task.id)">
                Excluir
              </button>
            </div>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="remove(task.id)">Excluir</ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </div>
    </div>
    <form class="fn-task-add" @submit.prevent="add">
      <ion-input
        ref="field"
        v-aria="'Nova tarefa'"
        label="Nova tarefa"
        label-placement="stacked"
        placeholder="O que falta fazer?"
        :value="draft"
        @ionInput="onDraft"
      />
      <ion-button type="submit" :disabled="draft.trim().length === 0">Adicionar</ion-button>
    </form>
  </section>
</template>
