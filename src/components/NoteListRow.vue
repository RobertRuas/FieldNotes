<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonActionSheet, IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/vue';
import { useNotesStore } from '@/stores/notesStore';
import type { NoteListRow } from '@/utils/noteList';
import { timeLabel } from '@/utils/dates';
import { displayTitle } from '@/utils/text';

const props = defineProps<{ row: NoteListRow }>();
const emit = defineEmits<{ open: [id: string] }>();
const notes = useNotesStore();
const sheet = ref(false);
const note = computed(() => (props.row.kind === 'note' ? props.row.note : null));

const buttons = [
  { text: 'Excluir nota', role: 'destructive' as const, handler: () => { void remove(); } },
  { text: 'Cancelar', role: 'cancel' as const },
];

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
            <time :datetime="note.createdAt">{{ timeLabel(note.createdAt) }}</time>
            <span>{{ displayTitle(note) }}</span>
          </button>
          <button type="button" class="fn-text-btn" aria-label="Ações da nota" @click="sheet = true">Ações</button>
        </div>
      </ion-item>
      <ion-item-options side="end">
        <ion-item-option color="danger" @click="remove">Excluir</ion-item-option>
      </ion-item-options>
    </ion-item-sliding>
    <ion-action-sheet :is-open="sheet" header="Nota" :buttons="buttons" @didDismiss="sheet = false" />
  </div>
</template>
