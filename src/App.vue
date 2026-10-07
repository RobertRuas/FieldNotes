<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { IonApp, IonRouterOutlet, IonToast } from '@ionic/vue';
import { useToast } from '@/composables/useToast';

const { message, clear } = useToast();

function pinBar(): void {
  const viewport = window.visualViewport;
  const top = viewport ? Math.max(0, Math.round(viewport.offsetTop)) : 0;
  document.documentElement.style.setProperty('--fn-bar-top', `${top}px`);
}

onMounted(() => {
  pinBar();
  window.visualViewport?.addEventListener('resize', pinBar);
  window.visualViewport?.addEventListener('scroll', pinBar);
  window.addEventListener('orientationchange', pinBar);
});

onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', pinBar);
  window.visualViewport?.removeEventListener('scroll', pinBar);
  window.removeEventListener('orientationchange', pinBar);
});
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
