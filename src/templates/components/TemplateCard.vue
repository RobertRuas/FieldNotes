<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { ellipsisHorizontal, playOutline } from 'ionicons/icons';
import type { NoteTemplate } from '@/templates/types';
import { fieldCountLabel } from '@/templates/utils/labels';

defineProps<{
  item: NoteTemplate;
  fields: number;
}>();

defineEmits<{
  open: [];
  run: [];
  menu: [];
}>();
</script>

<template>
  <article class="fn-template-card">
    <button type="button" class="fn-template-hit" @click="$emit('open')">
      <strong>{{ item.name }}</strong>
      <small>{{ fieldCountLabel(fields) }}</small>
    </button>
    <button type="button" class="fn-mini" aria-label="Executar" @click="$emit('run')">
      <ion-icon :icon="playOutline" aria-hidden="true" />
      <span>Executar</span>
    </button>
    <button type="button" class="fn-mini" aria-label="Ações" @click="$emit('menu')">
      <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
    </button>
  </article>
</template>

<style scoped>
.fn-template-card {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 6px 6px 10px;
  background: var(--fn-surface);
  border: 1px solid var(--fn-stroke);
  border-radius: var(--fn-radius);
}

.fn-template-hit {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
}

.fn-template-hit strong {
  font-size: 14px;
  font-weight: 650;
}

.fn-template-hit small {
  color: var(--fn-ink-soft);
  font-size: 11px;
}

.fn-mini {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 28px;
  padding: 0 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--fn-ink-soft);
  font: inherit;
  font-size: 11px;
}

.fn-mini ion-icon {
  font-size: 16px;
  color: var(--fn-ink);
}
</style>
