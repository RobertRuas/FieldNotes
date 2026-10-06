<script setup lang="ts">
import { ref } from 'vue';
import { IonActionSheet, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/vue';
import { ellipsisHorizontal } from 'ionicons/icons';
import { useNotesStore } from '@/stores/notesStore';
import type { Note } from '@/types/entities';
import { reminderLabel, timeLabel } from '@/utils/dates';
import { displayTitle, notePreview } from '@/utils/text';

const props = defineProps<{
  note: Note;
  accent: string | null;
}>();

const emit = defineEmits<{ open: [id: string] }>();
const notes = useNotesStore();
const sheet = ref(false);

const buttons = [
  { text: 'Excluir nota', role: 'destructive' as const, handler: () => { void remove(); } },
  { text: 'Cancelar', role: 'cancel' as const },
];

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
          <button type="button" class="fn-note-hit" @click="emit('open', note.id)">
            <time :datetime="note.createdAt">{{ timeLabel(note.createdAt) }}</time>
            <strong>{{ displayTitle(note) }}</strong>
            <p v-if="notePreview(note)">{{ notePreview(note) }}</p>
            <small v-if="note.reminderAt">Lembrete {{ reminderLabel(note.reminderAt) }}</small>
          </button>
          <button type="button" class="fn-more" aria-label="Ações da nota" @click="sheet = true">
            <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
          </button>
        </article>
      </ion-item>
      <ion-item-options side="end">
        <ion-item-option color="danger" @click="remove">Excluir</ion-item-option>
      </ion-item-options>
    </ion-item-sliding>
    <ion-action-sheet :is-open="sheet" header="Nota" :buttons="buttons" @didDismiss="sheet = false" />
  </div>
</template>
