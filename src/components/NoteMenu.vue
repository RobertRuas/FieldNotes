<script setup lang="ts">
import { computed } from 'vue';
import { IonActionSheet } from '@ionic/vue';
import { pushToast } from '@/composables/useToast';
import { shareText } from '@/services/platform/share';
import { speakAloud } from '@/services/platform/speech';
import { useNotesStore } from '@/stores/notesStore';
import type { Note } from '@/types/entities';
import { htmlToPlain } from '@/utils/html';
import { displayTitle, notePreview } from '@/utils/text';

const props = defineProps<{ note: Note; open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();
const notes = useNotesStore();

const buttons = computed(() => {
  const note = props.note;
  return [
    { text: 'Copiar texto', handler: () => { void copyNoteText(note); } },
    { text: 'Ler em voz alta', handler: () => { void readAloud(note); } },
    {
      text: note.favorite ? 'Remover favorito' : 'Marcar como favorito',
      handler: () => { void notes.setFlag(note.id, { favorite: !note.favorite }); },
    },
    {
      text: note.pinned ? 'Desafixar' : 'Fixar nota',
      handler: () => { void notes.setFlag(note.id, { pinned: !note.pinned }); },
    },
    { text: 'Compartilhar', handler: () => { void shareNote(note); } },
    { text: 'Excluir nota', role: 'destructive' as const, handler: () => { void notes.remove(note.id); } },
    { text: 'Cancelar', role: 'cancel' as const },
  ];
});

async function copyNoteText(note: Note): Promise<void> {
  const plain = htmlToPlain(note.text).trim();
  const textToCopy = plain || displayTitle(note);
  if (!textToCopy) {
    pushToast('Não há texto para copiar.');
    return;
  }
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) {
    try {
      const input = document.createElement('textarea');
      input.value = textToCopy;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.focus();
      input.select();
      copied = document.execCommand('copy');
      input.remove();
    } catch {
      copied = false;
    }
  }
  if (copied) {
    pushToast('Texto copiado.');
  } else {
    pushToast('Não foi possível copiar o texto.');
  }
}

async function readAloud(note: Note): Promise<void> {
  const spoken = htmlToPlain(note.text).trim();
  if (!spoken) {
    pushToast('Não há texto para ler.');
    return;
  }
  const started = await speakAloud(spoken);
  if (!started) pushToast('Este aparelho não lê em voz alta.');
}

async function shareNote(note: Note): Promise<void> {
  const body = notePreview(note);
  try {
    await shareText(displayTitle(note), body || displayTitle(note));
  } catch {
    pushToast('Não foi possível compartilhar.');
  }
}
</script>

<template>
  <ion-action-sheet
    :is-open="open"
    header="Nota"
    :buttons="buttons"
    @didDismiss="emit('update:open', false)"
  />
</template>
