<script setup lang="ts">
import { computed } from 'vue';
import type { Note } from '@/types/entities';
import { reminderLabel, timeLabel } from '@/utils/dates';
import { displayTitle, notePreview } from '@/utils/text';

const props = defineProps<{
  note: Note;
  accent: string | null;
}>();

const emit = defineEmits<{ open: [id: string] }>();
const title = computed(() => displayTitle(props.note));
const preview = computed(() => notePreview(props.note));
const when = computed(() => timeLabel(props.note.createdAt));
const reminder = computed(() => (props.note.reminderAt ? reminderLabel(props.note.reminderAt) : ''));
</script>

<template>
  <button
    type="button"
    class="fn-note-card"
    :style="{ '--card-accent': accent ?? 'transparent' }"
    @click="emit('open', note.id)"
  >
    <time :datetime="note.createdAt">{{ when }}</time>
    <strong>{{ title }}</strong>
    <p v-if="preview">{{ preview }}</p>
    <small v-if="reminder">Lembrete {{ reminder }}</small>
  </button>
</template>
