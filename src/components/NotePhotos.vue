<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonButtons, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import SyncMark from '@/components/SyncMark.vue';
import TransferLine from '@/components/TransferLine.vue';
import { pushToast } from '@/composables/useToast';
import { useAttachmentsStore } from '@/stores/attachmentsStore';
import type { Attachment } from '@/types/entities';
import { transferAsSync, visibleTransfer } from '@/sync/fileQueue';
import { fileSizeLabel } from '@/utils/files';

const props = withDefaults(
  defineProps<{ noteId: string; bare?: boolean; editable?: boolean }>(),
  { editable: true },
);
const emit = defineEmits<{ changed: [] }>();
const attachments = useAttachmentsStore();
const libraryInput = ref<HTMLInputElement | null>(null);
const viewUrl = ref<string | null>(null);
const viewName = ref('');

const photos = computed(() => attachments.forNote(props.noteId).filter((item) => item.kind === 'photo'));

function filesOf(event: Event): File[] {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files) return [];
  const files = [...input.files];
  input.value = '';
  return files;
}

async function addMany(files: File[]): Promise<void> {
  let added = false;
  for (const file of files) {
    const created = await attachments.addPhoto(props.noteId, file);
    if (created) added = true;
  }
  if (added) emit('changed');
}

async function pickPhoto(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const created = await attachments.addFromNative(props.noteId, 'photos');
      if (created) emit('changed');
    } catch {
      pushToast('Não foi possível abrir as fotos.');
    }
    return;
  }
  libraryInput.value?.click();
}

async function openPhoto(item: Attachment): Promise<void> {
  const url = await attachments.originalUrl(item);
  if (!url) {
    pushToast('Não foi possível abrir a foto.');
    return;
  }
  closePhoto();
  viewUrl.value = url;
  viewName.value = item.name;
}

function closePhoto(): void {
  if (viewUrl.value) URL.revokeObjectURL(viewUrl.value);
  viewUrl.value = null;
  viewName.value = '';
}

async function remove(item: Attachment): Promise<void> {
  await attachments.remove(item.id);
  emit('changed');
}

onBeforeUnmount(closePhoto);
</script>

<template>
  <section v-if="!bare || photos.length > 0" class="fn-media" :class="{ 'is-bare': bare }" aria-label="Fotos">
    <h2 v-if="!bare">Fotos</h2>
    <div v-if="!bare" class="fn-media-actions">
      <ion-button size="small" fill="outline" @click="pickPhoto">Adicionar fotografia</ion-button>
    </div>
    <input ref="libraryInput" class="fn-sr" type="file" accept="image/*" multiple aria-label="Adicionar fotografia" @change="addMany(filesOf($event))" />
    <p v-if="photos.length === 0 && !bare" class="fn-muted">Nenhuma foto nesta nota.</p>
    <p v-if="photos.length > 0" class="fn-attach-cat">Fotos</p>
    <ul v-if="photos.length > 0" class="fn-attach-list">
      <li v-for="photo in photos" :key="photo.id">
        <button type="button" class="fn-attach-name" :aria-label="`Abrir ${photo.name}`" @click="openPhoto(photo)">
          {{ photo.name }}
        </button>
        <small>{{ fileSizeLabel(photo.size) }}</small>
        <SyncMark :status="transferAsSync(visibleTransfer(photo, attachments.transferFor(photo.id)))" />
        <button v-if="editable" type="button" class="fn-attach-x" :aria-label="`Excluir ${photo.name}`" @click="remove(photo)">
          <ion-icon :icon="closeOutline" aria-hidden="true" />
        </button>
        <TransferLine
          :status="visibleTransfer(photo, attachments.transferFor(photo.id))"
          @retry="attachments.retry(photo.id)"
        />
      </li>
    </ul>
    <ion-modal :is-open="viewUrl !== null" @didDismiss="closePhoto">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ viewName || 'Foto' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closePhoto">Fechar</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <div class="fn-viewer">
        <img v-if="viewUrl" :src="viewUrl" :alt="viewName" />
      </div>
    </ion-modal>
  </section>
</template>
