<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { useTasksStore } from '@/stores/tasksStore';

const props = withDefaults(
  defineProps<{
    noteId: string;
    collectionId: string | null;
    date: string;
    editable?: boolean;
  }>(),
  {
    editable: true,
  },
);

const emit = defineEmits<{ changed: [] }>();
const tasks = useTasksStore();
const draft = ref('');
const composing = ref(false);
const field = ref<HTMLInputElement | null>(null);

const items = computed(() => tasks.forNote(props.noteId));
const visible = computed(() => items.value.length > 0 || composing.value);

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

function onBlur(): void {
  if (!draft.value.trim()) composing.value = false;
}

async function focusNew(): Promise<void> {
  composing.value = true;
  await nextTick();
  field.value?.focus();
}

defineExpose({ focusNew });
</script>

<template>
  <section v-show="visible" class="fn-note-tasks" aria-label="Tarefas da nota">
    <p class="fn-attach-cat">Tarefas</p>
    <ul v-if="items.length > 0" class="fn-attach-list">
      <li v-for="task in items" :key="task.id">
        <button
          type="button"
          class="fn-checkhit"
          :aria-pressed="task.done"
          :aria-label="task.done ? 'Marcar como pendente' : 'Marcar como feita'"
          @click="tasks.toggle(task.id)"
        >
          <i />
        </button>
        <span class="fn-attach-name" :class="{ 'fn-task-done': task.done }">{{ task.title }}</span>
        <button v-if="editable" type="button" class="fn-attach-x" :aria-label="`Excluir ${task.title}`" @click="remove(task.id)">
          <ion-icon :icon="closeOutline" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <form v-if="composing && editable" class="fn-task-add" @submit.prevent="add">
      <input
        ref="field"
        v-model="draft"
        class="fn-task-draft"
        type="text"
        enterkeyhint="done"
        aria-label="Nova tarefa"
        placeholder="Nova tarefa"
        @blur="onBlur"
      />
    </form>
  </section>
</template>
