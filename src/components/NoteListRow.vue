<script setup lang="ts">
import { computed } from 'vue';
import type { NoteListRow } from '@/utils/noteList';
import { timeLabel } from '@/utils/dates';
import { displayTitle } from '@/utils/text';

const props = defineProps<{ row: NoteListRow }>();
const emit = defineEmits<{ open: [id: string] }>();

const header = computed(() => (props.row.kind === 'header' ? props.row : null));
const noteRow = computed(() => (props.row.kind === 'note' ? props.row : null));
</script>

<template>
  <h2 v-if="header" class="fn-group" :style="{ height: `${header.height}px` }">{{ header.label }}</h2>
  <button
    v-else-if="noteRow"
    type="button"
    class="fn-list-row"
    :style="{ height: `${noteRow.height}px` }"
    @click="emit('open', noteRow.note.id)"
  >
    <time :datetime="noteRow.note.createdAt">{{ timeLabel(noteRow.note.createdAt) }}</time>
    <span>{{ displayTitle(noteRow.note) }}</span>
  </button>
</template>
