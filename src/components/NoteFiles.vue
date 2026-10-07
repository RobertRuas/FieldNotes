<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import SyncMark from '@/components/SyncMark.vue';
import TransferLine from '@/components/TransferLine.vue';
import { useAttachmentsStore } from '@/stores/attachmentsStore';
import { transferAsSync, visibleTransfer } from '@/sync/fileQueue';
import { fileSizeLabel } from '@/utils/files';

const props = withDefaults(
  defineProps<{ noteId: string; bare?: boolean; editable?: boolean }>(),
  { editable: true },
);
const emit = defineEmits<{ changed: [] }>();
const attachments = useAttachmentsStore();
const picker = ref<HTMLInputElement | null>(null);

const files = computed(() => attachments.forNote(props.noteId).filter((item) => item.kind !== 'photo'));

async function onPick(event: Event): Promise<void> {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files) return;
  const chosen = [...input.files];
  input.value = '';
  let added = false;
  for (const file of chosen) {
    const created = await attachments.addDocument(props.noteId, file);
    if (created) added = true;
  }
  if (added) emit('changed');
}

async function remove(id: string): Promise<void> {
  await attachments.remove(id);
  emit('changed');
}
</script>

<template>
  <section v-if="!bare || files.length > 0" class="fn-media" :class="{ 'is-bare': bare }" aria-label="Documentos">
    <h2 v-if="!bare">Documentos</h2>
    <ion-button v-if="!bare" size="small" fill="outline" @click="picker?.click()">Anexar arquivo</ion-button>
    <input
      ref="picker"
      class="fn-file-input"
      type="file"
      multiple
      aria-label="Anexar arquivo"
      @change="onPick"
    />
    <p v-if="files.length === 0 && !bare" class="fn-muted">Nenhum arquivo nesta nota.</p>
    <p v-if="files.length > 0" class="fn-attach-cat">Documentos</p>
    <ul v-if="files.length > 0" class="fn-attach-list">
      <li v-for="file in files" :key="file.id">
        <span class="fn-attach-name">{{ file.name }}</span>
        <small>{{ fileSizeLabel(file.size) }}</small>
        <SyncMark :status="transferAsSync(visibleTransfer(file, attachments.transferFor(file.id)))" />
        <button v-if="editable" type="button" class="fn-attach-x" :aria-label="`Excluir ${file.name}`" @click="remove(file.id)">
          <ion-icon :icon="closeOutline" aria-hidden="true" />
        </button>
        <TransferLine
          :status="visibleTransfer(file, attachments.transferFor(file.id))"
          @retry="attachments.retry(file.id)"
        />
      </li>
    </ul>
  </section>
</template>
