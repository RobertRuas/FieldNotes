<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonButtons, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue';
import TransferLine from '@/components/TransferLine.vue';
import { pushToast } from '@/composables/useToast';
import { useAttachmentsStore } from '@/stores/attachmentsStore';
import type { Attachment } from '@/types/entities';
import { visibleTransfer } from '@/sync/fileQueue';

const props = defineProps<{ noteId: string; bare?: boolean }>();
const emit = defineEmits<{ changed: [] }>();
const attachments = useAttachmentsStore();
const cameraInput = ref<HTMLInputElement | null>(null);
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

async function takePhoto(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const created = await attachments.addFromNative(props.noteId, 'camera');
      if (created) emit('changed');
    } catch {
      pushToast('Não foi possível abrir a câmera.');
    }
    return;
  }
  cameraInput.value?.click();
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
      <ion-button size="small" @click="takePhoto">Tirar foto</ion-button>
      <ion-button size="small" fill="outline" @click="pickPhoto">Escolher foto</ion-button>
    </div>
    <input ref="cameraInput" class="fn-sr" type="file" accept="image/*" capture="environment" aria-label="Tirar foto" @change="addMany(filesOf($event))" />
    <input ref="libraryInput" class="fn-sr" type="file" accept="image/*" multiple aria-label="Escolher foto" @change="addMany(filesOf($event))" />
    <p v-if="photos.length === 0 && !bare" class="fn-muted">Nenhuma foto nesta nota.</p>
    <div v-else class="fn-photos">
      <figure v-for="photo in photos" :key="photo.id" class="fn-photo-card">
        <button type="button" class="fn-photo-hit" :aria-label="`Abrir ${photo.name}`" @click="openPhoto(photo)">
          <img v-if="photo.thumbnail" :src="photo.thumbnail" alt="" />
          <span v-else class="fn-photo-fallback">Foto</span>
        </button>
        <TransferLine
          :status="visibleTransfer(photo, attachments.transferFor(photo.id))"
          @retry="attachments.retry(photo.id)"
        />
        <button type="button" class="fn-text-btn" :aria-label="`Excluir ${photo.name}`" @click="remove(photo)">Excluir</button>
      </figure>
    </div>
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
