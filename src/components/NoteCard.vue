<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/vue';
import { checkboxOutline, ellipsisHorizontal, star } from 'ionicons/icons';
import NoteMenu from '@/components/NoteMenu.vue';
import SyncMark from '@/components/SyncMark.vue';
import { useNotesStore } from '@/stores/notesStore';
import { useTasksStore } from '@/stores/tasksStore';
import type { Note } from '@/types/entities';
import { reminderLabel } from '@/utils/dates';
import { displayTitle, highlightPlain, notePreview, searchSnippet } from '@/utils/text';

const props = defineProps<{
  note: Note;
  accent: string | null;
  query?: string;
}>();

const emit = defineEmits<{
  open: [id: string];
  press: [event: PointerEvent];
  move: [event: PointerEvent];
  lift: [event: PointerEvent];
  copy: [];
}>();
const notes = useNotesStore();
const tasksStore = useTasksStore();
const sheet = ref(false);

const noteTasks = computed(() => tasksStore.forNote(props.note.id));
const pendingTasks = computed(() => noteTasks.value.filter((t) => !t.done).length);
const titleHtml = computed(() => (props.query ? highlightPlain(displayTitle(props.note), props.query) : ''));
const previewText = computed(() => (props.query ? searchSnippet(props.note, props.query) : notePreview(props.note)));
const previewHtml = computed(() => (props.query ? highlightPlain(previewText.value, props.query) : ''));

async function remove(): Promise<void> {
  sheet.value = false;
  await notes.remove(props.note.id);
}
</script>

<template>
  <div class="fn-row-host">
    <ion-item-sliding class="fn-slide">
      <ion-item lines="none" class="fn-slide-item">
        <article class="fn-note-card" :style="{ '--card-accent': accent ?? 'transparent' }">
          <div
            role="button"
            tabindex="0"
            class="fn-note-hit"
            @click="emit('open', note.id)"
            @keydown.enter.prevent="emit('open', note.id)"
            @keydown.space.prevent="emit('open', note.id)"
            @pointerdown="emit('press', $event)"
            @pointermove="emit('move', $event)"
            @pointerup="emit('lift', $event)"
            @pointercancel="emit('lift', $event)"
            @contextmenu.prevent="emit('copy')"
          >
            <span class="fn-note-stamp">
              <strong v-if="query" v-html="titleHtml" />
              <strong v-else>{{ displayTitle(note) }}</strong>
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
            <p v-if="query && previewHtml" v-html="previewHtml" />
            <p v-else-if="previewText">{{ previewText }}</p>
            <small v-if="note.reminderAt">Lembrete {{ reminderLabel(note.reminderAt) }}</small>
          </div>
          <button type="button" class="fn-more" aria-label="Ações da nota" @click="sheet = true">
            <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
          </button>
        </article>
      </ion-item>
      <ion-item-options side="end">
        <ion-item-option color="danger" @click="remove">Excluir</ion-item-option>
      </ion-item-options>
    </ion-item-sliding>
    <NoteMenu :note="note" :open="sheet" @update:open="sheet = $event" />
  </div>
</template>
