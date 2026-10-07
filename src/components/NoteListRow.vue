<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/vue';
import { checkboxOutline, ellipsisHorizontal, star } from 'ionicons/icons';
import NoteMenu from '@/components/NoteMenu.vue';
import SyncMark from '@/components/SyncMark.vue';
import { useNotesStore } from '@/stores/notesStore';
import { useTasksStore } from '@/stores/tasksStore';
import type { NoteListRow } from '@/utils/noteList';
import { displayTitle, notePreview } from '@/utils/text';

const props = defineProps<{ row: NoteListRow }>();
const emit = defineEmits<{ open: [id: string] }>();
const notes = useNotesStore();
const tasksStore = useTasksStore();
const sheet = ref(false);
const note = computed(() => (props.row.kind === 'note' ? props.row.note : null));

const noteTasks = computed(() => (note.value ? tasksStore.forNote(note.value.id) : []));
const pendingTasks = computed(() => noteTasks.value.filter((t) => !t.done).length);

async function remove(): Promise<void> {
  sheet.value = false;
  if (!note.value) return;
  await notes.remove(note.value.id);
}
</script>

<template>
  <h2 v-if="row.kind === 'header'" class="fn-group" :style="{ height: `${row.height}px` }">{{ row.label }}</h2>
  <div v-else-if="note" class="fn-row-host" :style="{ height: `${row.height}px` }">
    <ion-item-sliding class="fn-slide">
      <ion-item lines="none" class="fn-slide-item">
        <div class="fn-list-row">
          <button type="button" class="fn-list-hit" @click="emit('open', note.id)">
            <span class="fn-note-stamp">
              <strong>{{ displayTitle(note) }}</strong>
              <SyncMark :status="note.syncStatus" />
              <ion-icon v-if="note.favorite" class="fn-flag" :icon="star" aria-label="Favorita" />
              <span
                v-if="pendingTasks > 0"
                class="fn-note-task-flag"
                :title="`${pendingTasks} tarefa(s) pendente(s)`"
                :aria-label="`${pendingTasks} tarefas pendentes`"
              >
                <ion-icon :icon="checkboxOutline" aria-hidden="true" />
                <span>{{ pendingTasks }}</span>
              </span>
            </span>
            <small v-if="notePreview(note)">{{ notePreview(note) }}</small>
          </button>
          <button type="button" class="fn-more" aria-label="Ações da nota" @click="sheet = true">
            <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
          </button>
        </div>
      </ion-item>
      <ion-item-options side="end">
        <ion-item-option color="danger" @click="remove">Excluir</ion-item-option>
      </ion-item-options>
    </ion-item-sliding>
    <NoteMenu v-if="note" :note="note" :open="sheet" @update:open="sheet = $event" />
  </div>
</template>
