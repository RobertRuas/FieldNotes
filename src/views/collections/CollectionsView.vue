<script setup lang="ts">
import { ref } from 'vue';
import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonPage, IonToolbar } from '@ionic/vue';
import EmptyState from '@/components/EmptyState.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { readIonText } from '@/utils/ionic';

const collections = useCollectionsStore();
const name = ref('');

function onName(event: Event): void {
  name.value = readIonText(event);
}

async function add(): Promise<void> {
  const current = name.value;
  name.value = '';
  await collections.add(current);
}
</script>

<template>
  <ion-page>
    <ion-header class="fn-header" translucent>
      <ion-toolbar>
        <div class="fn-titlebar">
          <h1>Coleções</h1>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="fn-page" fullscreen>
      <SyncStatus />
      <form class="fn-form" @submit.prevent="add">
        <ion-input
          label="Nome da coleção"
          label-placement="stacked"
          aria-label="Nome da coleção"
          placeholder="Ex.: Campo, ideias, visitas"
          :value="name"
          @ionInput="onName"
        />
        <ion-button type="submit" expand="block" :disabled="name.trim().length === 0">Criar coleção</ion-button>
      </form>
      <EmptyState
        v-if="collections.ordered.length === 0"
        title="Nenhuma coleção ainda"
        body="Uma coleção agrupa notas, como um caderno."
      />
      <ion-list v-else class="fn-inset" lines="none">
        <ion-item v-for="item in collections.ordered" :key="item.id">
          <span slot="start" class="fn-swatch" :style="{ background: item.color }" aria-hidden="true" />
          <ion-label>{{ item.name }}</ion-label>
          <ion-button slot="end" fill="clear" :aria-label="`Excluir ${item.name}`" @click="collections.remove(item.id)">
            Excluir
          </ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>
