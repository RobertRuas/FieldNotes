<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { ellipsisHorizontal } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import NoteCard from '@/components/NoteCard.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useNotesStore } from '@/stores/notesStore';
import { readIonText } from '@/utils/ionic';
import { noteCountLabel } from '@/utils/text';

const route = useRoute();
const router = useRouter();
const collections = useCollectionsStore();
const notes = useNotesStore();
const sheetOpen = ref(false);
const renameOpen = ref(false);
const renameDraft = ref('');
let pendingRename = false;

const collectionId = computed(() => (typeof route.params.collectionId === 'string' ? route.params.collectionId : ''));
const collection = computed(() => collections.items.find((item) => item.id === collectionId.value) ?? null);
const listed = computed(() => (collection.value ? notes.inCollection(collection.value.id) : []));

const sheetButtons = computed(() => [
  { text: 'Renomear', handler: () => { pendingRename = true; } },
  {
    text: 'Excluir coleção',
    role: 'destructive' as const,
    handler: () => {
      void removeCollection();
    },
  },
  { text: 'Cancelar', role: 'cancel' as const },
]);

function onRename(event: Event): void {
  renameDraft.value = readIonText(event);
}

function onSheetDismiss(): void {
  sheetOpen.value = false;
  if (!pendingRename || !collection.value) {
    pendingRename = false;
    return;
  }
  pendingRename = false;
  renameDraft.value = collection.value.name;
  renameOpen.value = true;
}

async function confirmRename(): Promise<void> {
  if (!collection.value) return;
  await collections.rename(collection.value.id, renameDraft.value);
  renameOpen.value = false;
}

async function removeCollection(): Promise<void> {
  const id = collection.value?.id;
  if (!id) return;
  await collections.remove(id);
  if (collections.items.some((item) => item.id === id)) return;
  await router.replace('/colecoes');
}

function openNote(id: string): void {
  void router.push({ name: 'editor', params: { noteId: id } });
}

function back(): void {
  void router.replace('/colecoes');
}
</script>

<template>
  <ion-page>
    <AppHeader :title="collection?.name ?? 'Coleção'" back @back="back">
      <ion-button v-if="collection" fill="clear" class="fn-icon-btn" v-aria="'Ações da coleção'" @click="sheetOpen = true">
        <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
      </ion-button>
    </AppHeader>
    <ion-content class="fn-page">
      <p v-if="!collection" class="fn-boot" role="alert">Coleção não encontrada.</p>
      <template v-else>
        <SyncStatus />
        <div class="fn-day-head">
          <h2>{{ collection.name }}</h2>
          <p>{{ noteCountLabel(listed.length) }}</p>
        </div>
        <EmptyState
          v-if="listed.length === 0"
          title="Nenhuma nota nesta coleção"
          body="Escolha esta coleção ao escrever uma nota. A nota continua existindo se a coleção sair."
        />
        <div v-else class="fn-notes">
          <NoteCard
            v-for="note in listed"
            :key="note.id"
            :note="note"
            :accent="collection.color"
            @open="openNote"
          />
        </div>
      </template>
    </ion-content>
    <ion-action-sheet :is-open="sheetOpen" header="Coleção" :buttons="sheetButtons" @didDismiss="onSheetDismiss" />
    <ion-modal :is-open="renameOpen" @didDismiss="renameOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Renomear</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="renameOpen = false">Fechar</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <form class="fn-modal-body" @submit.prevent="confirmRename">
          <ion-input
            label="Nome"
            label-placement="stacked"
            v-aria="'Novo nome da coleção'"
            :value="renameDraft"
            @ionInput="onRename"
          />
          <ion-button type="submit" expand="block" :disabled="renameDraft.trim().length === 0">Guardar nome</ion-button>
        </form>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>
