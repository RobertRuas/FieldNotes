<script setup lang="ts">
import { IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue';
import { albumsOutline, documentTextOutline, settingsOutline } from 'ionicons/icons';
</script>

<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" class="fn-tabs">
        <ion-tab-button tab="notas" href="/notas">
          <ion-icon :icon="documentTextOutline" aria-hidden="true" />
          <ion-label>Notas</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="colecoes" href="/colecoes">
          <ion-icon :icon="albumsOutline" aria-hidden="true" />
          <ion-label>Coleções</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="configuracoes" href="/configuracoes">
          <ion-icon :icon="settingsOutline" aria-hidden="true" />
          <ion-label>Configurações</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>
