<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { IonActionSheet, IonButton, IonInput } from '@ionic/vue';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useNotesStore } from '@/stores/notesStore';
import { useTasksStore } from '@/stores/tasksStore';
import type { Task, TaskPriority } from '@/types/entities';
import { fromLocalDateTimeInput, isDateKey, isTimeKey, toLocalDateTimeInput } from '@/utils/dates';
import { readIonText } from '@/utils/ionic';
import { displayTitle } from '@/utils/text';
import { priorityLabel } from '@/utils/tasks';

const props = defineProps<{ taskId: string }>();
const emit = defineEmits<{ close: [] }>();

const tasks = useTasksStore();
const collections = useCollectionsStore();
const notes = useNotesStore();

const title = ref('');
const detail = ref('');
const date = ref('');
const time = ref('');
const priority = ref<TaskPriority | null>(null);
const reminder = ref('');
const collectionId = ref<string | null>(null);
const noteId = ref<string | null>(null);
const collectionOpen = ref(false);
const noteOpen = ref(false);
let titleTimer = 0;

const current = computed(() => tasks.tasks.find((task) => task.id === props.taskId) ?? null);
const priorities: { id: TaskPriority | null; label: string }[] = [
  { id: null, label: 'Nenhuma' },
  { id: 'baixa', label: 'Baixa' },
  { id: 'normal', label: 'Normal' },
  { id: 'alta', label: 'Alta' },
];

const collectionLabel = computed(() => {
  if (!collectionId.value) return 'Sem coleção';
  return collections.items.find((item) => item.id === collectionId.value)?.name ?? 'Sem coleção';
});

const noteLabel = computed(() => {
  if (!noteId.value) return 'Sem nota';
  const note = notes.notes.find((item) => item.id === noteId.value);
  return note ? displayTitle(note) : 'Sem nota';
});

interface SheetButton {
  text: string;
  role?: 'cancel';
  handler?: () => void;
}

const collectionButtons = computed<SheetButton[]>(() => [
  ...collections.ordered.map((item) => ({
    text: item.name,
    handler: () => { void apply({ collectionId: item.id }); },
  })),
  { text: 'Sem coleção', handler: () => { void apply({ collectionId: null }); } },
  { text: 'Cancelar', role: 'cancel' },
]);

const noteButtons = computed<SheetButton[]>(() => [
  ...notes.notes.map((note) => ({
    text: displayTitle(note),
    handler: () => { void apply({ noteId: note.id }); },
  })),
  { text: 'Sem nota', handler: () => { void apply({ noteId: null }); } },
  { text: 'Cancelar', role: 'cancel' },
]);

watch(
  () => current.value?.id ?? '',
  () => {
    const task = current.value;
    if (!task) return;
    title.value = task.title;
    detail.value = task.detail;
    date.value = task.date ?? '';
    time.value = task.time ?? '';
    priority.value = task.priority;
    reminder.value = toLocalDateTimeInput(task.reminderAt);
    collectionId.value = task.collectionId;
    noteId.value = task.noteId;
  },
  { immediate: true },
);

function draftFrom(task: Task): Task {
  return {
    ...task,
    title: title.value,
    detail: detail.value,
    date: date.value && isDateKey(date.value) ? date.value : null,
    time: time.value && isTimeKey(time.value) ? time.value : null,
    priority: priority.value,
    reminderAt: fromLocalDateTimeInput(reminder.value),
    collectionId: collectionId.value,
    noteId: noteId.value,
  };
}

async function apply(partial: Partial<Task>): Promise<void> {
  const task = current.value;
  if (!task) return;
  if (partial.title !== undefined) title.value = partial.title;
  if (partial.detail !== undefined) detail.value = partial.detail;
  if (partial.date !== undefined) date.value = partial.date ?? '';
  if (partial.time !== undefined) time.value = partial.time ?? '';
  if (partial.priority !== undefined) priority.value = partial.priority;
  if (partial.reminderAt !== undefined) reminder.value = toLocalDateTimeInput(partial.reminderAt);
  if (partial.collectionId !== undefined) collectionId.value = partial.collectionId;
  if (partial.noteId !== undefined) noteId.value = partial.noteId;
  const next = draftFrom(task);
  if (!next.title.trim()) return;
  await tasks.save(next);
}

function onTitle(event: Event): void {
  title.value = readIonText(event);
  window.clearTimeout(titleTimer);
  titleTimer = window.setTimeout(() => { void apply({ title: title.value }); }, 400);
}

function onDetail(event: Event): void {
  detail.value = readIonText(event);
  window.clearTimeout(titleTimer);
  titleTimer = window.setTimeout(() => { void apply({ detail: detail.value }); }, 400);
}

function onDate(event: Event): void {
  const value = event.target instanceof HTMLInputElement ? event.target.value : '';
  void apply({ date: value && isDateKey(value) ? value : null });
}

function onTime(event: Event): void {
  const value = event.target instanceof HTMLInputElement ? event.target.value : '';
  void apply({ time: value && isTimeKey(value) ? value : null });
}

function onReminder(event: Event): void {
  const value = event.target instanceof HTMLInputElement ? event.target.value : '';
  reminder.value = value;
  void apply({ reminderAt: fromLocalDateTimeInput(value) });
}

onBeforeUnmount(() => {
  window.clearTimeout(titleTimer);
  const task = current.value;
  if (!task) return;
  const next = draftFrom(task);
  if (!next.title.trim()) return;
  if (next.title === task.title && next.detail === task.detail) return;
  void tasks.save(next);
});
</script>

<template>
  <div class="fn-modal-body" v-if="current">
    <ion-input label="Título" label-placement="stacked" v-aria="'Título da tarefa'" :value="title" @ionInput="onTitle" />
    <ion-input label="Detalhe" label-placement="stacked" v-aria="'Detalhe da tarefa'" :value="detail" @ionInput="onDetail" />
    <label class="fn-field">
      <span>Data</span>
      <input class="fn-native-time" type="date" :value="date" @change="onDate" />
    </label>
    <label class="fn-field">
      <span>Hora</span>
      <input class="fn-native-time" type="time" :value="time" @change="onTime" />
    </label>
    <div>
      <p class="fn-muted" id="fn-priority-label">Prioridade</p>
      <div class="fn-priority" role="group" aria-labelledby="fn-priority-label">
        <button
          v-for="option in priorities"
          :key="option.label"
          type="button"
          class="fn-chip"
          :aria-pressed="priority === option.id"
          @click="apply({ priority: option.id })"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
    <label class="fn-field">
      <span>Lembrete</span>
      <input class="fn-native-time" type="datetime-local" :value="reminder" @change="onReminder" />
    </label>
    <p class="fn-muted">O horário fica guardado nesta tarefa. O aviso do sistema ainda não é enviado.</p>
    <button type="button" class="fn-chip" @click="collectionOpen = true">Coleção: {{ collectionLabel }}</button>
    <button type="button" class="fn-chip" @click="noteOpen = true">Nota: {{ noteLabel }}</button>
    <p v-if="priority" class="fn-sr">Prioridade {{ priorityLabel(priority) }}</p>
    <ion-button expand="block" fill="clear" @click="emit('close')">Fechar</ion-button>
    <ion-action-sheet :is-open="collectionOpen" header="Coleção" :buttons="collectionButtons" @didDismiss="collectionOpen = false" />
    <ion-action-sheet :is-open="noteOpen" header="Nota" :buttons="noteButtons" @didDismiss="noteOpen = false" />
  </div>
  <p v-else class="fn-modal-body">Tarefa não encontrada.</p>
</template>
