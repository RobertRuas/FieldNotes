<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { chevronBack } from 'ionicons/icons';

defineProps<{ title: string; back?: boolean; searching?: boolean }>();
const emit = defineEmits<{ back: [] }>();
</script>

<template>
  <header class="fn-appbar" :class="{ 'is-searching': searching }">
    <div class="fn-titlebar">
      <div class="fn-brand">
        <button v-if="back" type="button" class="fn-icon-btn fn-back" aria-label="Voltar" @click="emit('back')">
          <ion-icon :icon="chevronBack" aria-hidden="true" />
        </button>
        <h1>{{ title }}</h1>
        <slot name="beside" />
      </div>
      <div class="fn-title-actions">
        <slot />
      </div>
    </div>
  </header>
  <div class="fn-appbar-spacer" aria-hidden="true" />
</template>
