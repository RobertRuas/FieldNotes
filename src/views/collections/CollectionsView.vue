<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import EmptyState from '@/components/EmptyState.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useNotesStore } from '@/stores/notesStore';
import { COLLECTION_EXAMPLES } from '@/utils/collections';
import { readIonText } from '@/utils/ionic';
import { noteCountLabel } from '@/utils/text';

const router = useRouter();
const collections = useCollectionsStore();
const notes = useNotesStore();
const name = ref('');
const sheetId = ref<string | null>(null);
const renameOpen = ref(false);
const renameId = ref<string | null>(null);
const renameDraft = ref('');
let pendingRename: string | null = null;

const sheetOpen = computed(() => sheetId.value !== null);

const sheetButtons = computed(() => {
  const id = sheetId.value;
  return [
    { text: 'Renomear', handler: () => { pendingRename = id; } },
    {
      text: 'Excluir coleção',
      role: 'destructive' as const,
      handler: () => {
        if (id) void collections.remove(id);
      },
    },
    { text: 'Cancelar', role: 'cancel' as const },
  ];
});

function onName(event: Event): void {
  name.value = readIonText(event);
}

function onRename(event: Event): void {
  renameDraft.value = readIonText(event);
}

async function add(): Promise<void> {
  const created = await collections.add(name.value);
  if (created) name.value = '';
}

function openCollection(id: string): void {
  void router.push({ name: 'colecao', params: { collectionId: id } });
}

function beginRename(id: string): void {
  const item = collections.items.find((entry) => entry.id === id);
  if (!item) return;
  renameId.value = item.id;
  renameDraft.value = item.name;
  renameOpen.value = true;
}

function onSheetDismiss(): void {
  const id = pendingRename;
  pendingRename = null;
  sheetId.value = null;
  if (id) beginRename(id);
}

async function confirmRename(): Promise<void> {
  if (!renameId.value) return;
  await collections.rename(renameId.value, renameDraft.value);
  renameOpen.value = false;
}
</script>

<template>
  <ion-page>
    <ion-header class="fn-header">
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
          v-aria="'Nome da coleção'"
          :value="name"
          @ionInput="onName"
        />
        <ion-button type="submit" expand="block" :disabled="name.trim().length === 0">Criar coleção</ion-button>
      </form>
      <EmptyState
        v-if="collections.ordered.length === 0"
        title="Nenhuma coleção ainda"
        body="Uma coleção agrupa notas, como um caderno. Os exemplos abaixo só viram coleção se você tocar."
      >
        <div class="fn-suggest">
          <button
            v-for="example in COLLECTION_EXAMPLES"
            :key="example"
            type="button"
            class="fn-chip"
            @click="collections.add(example)"
          >
            {{ example }}
          </button>
        </div>
      </EmptyState>
      <div v-else class="fn-stack">
        <div v-for="item in collections.ordered" :key="item.id" class="fn-row-host">
          <ion-item-sliding class="fn-slide">
            <ion-item lines="none" class="fn-slide-item">
              <article class="fn-collection-card">
                <button type="button" class="fn-collection-hit" @click="openCollection(item.id)">
                  <span class="fn-swatch" :style="{ background: item.color }" aria-hidden="true" />
                  <span class="fn-collection-copy">
                    <strong>{{ item.name }}</strong>
                    <small>{{ noteCountLabel(notes.inCollection(item.id).length) }}</small>
                  </span>
                </button>
                <button
                  type="button"
                  class="fn-text-btn"
                  :aria-label="`Ações de ${item.name}`"
                  @click="sheetId = item.id"
                >
                  Ações
                </button>
              </article>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option @click="beginRename(item.id)">Renomear</ion-item-option>
              <ion-item-option color="danger" @click="collections.remove(item.id)">Excluir</ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </div>
      </div>
    </ion-content>
    <ion-action-sheet
      :is-open="sheetOpen"
      header="Coleção"
      :buttons="sheetButtons"
      @didDismiss="onSheetDismiss"
    />
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
