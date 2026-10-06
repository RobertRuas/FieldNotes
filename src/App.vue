<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonToast } from '@ionic/vue';
import { useToast } from '@/composables/useToast';

const { message, clear } = useToast();
</script>

<template>
  <ion-app class="fn-app">
    <ion-router-outlet />
    <ion-toast
      :is-open="message !== null"
      :message="message ?? ''"
      duration="2600"
      position="bottom"
      @didDismiss="clear"
    />
  </ion-app>
</template>
