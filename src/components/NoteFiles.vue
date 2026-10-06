<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonButton } from '@ionic/vue';
import TransferLine from '@/components/TransferLine.vue';
import { useAttachmentsStore } from '@/stores/attachmentsStore';
import { visibleTransfer } from '@/sync/fileQueue';
import { fileSizeLabel } from '@/utils/files';

const props = defineProps<{ noteId: string }>();
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
  <section class="fn-media" aria-label="Documentos">
    <h2>Documentos</h2>
    <ion-button size="small" fill="outline" @click="picker?.click()">Anexar arquivo</ion-button>
    <input
      ref="picker"
      class="fn-sr"
      type="file"
      multiple
      aria-label="Anexar arquivo"
      @change="onPick"
    />
    <p v-if="files.length === 0" class="fn-muted">Nenhum arquivo nesta nota.</p>
    <ul v-else class="fn-files">
      <li v-for="file in files" :key="file.id">
        <div class="fn-file-row">
          <img v-if="file.thumbnail" class="fn-file-thumb" :src="file.thumbnail" alt="" />
          <div>
            <strong>{{ file.name }}</strong>
            <small>{{ fileSizeLabel(file.size) }}</small>
            <TransferLine
              :status="visibleTransfer(file, attachments.transferFor(file.id))"
              @retry="attachments.retry(file.id)"
            />
          </div>
          <button type="button" class="fn-text-btn" :aria-label="`Excluir ${file.name}`" @click="remove(file.id)">
            Excluir
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
