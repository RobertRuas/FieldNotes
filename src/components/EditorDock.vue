<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { IonIcon } from '@ionic/vue';
import { attachOutline, imageOutline, micOutline } from 'ionicons/icons';
import EditorToolbar from '@/components/EditorToolbar.vue';
import type { EditorCommand } from '@/composables/editorContext';
import { pushToast } from '@/composables/useToast';
import { openMicrophone, stopStream } from '@/services/platform/recorder';
import { useAttachmentsStore } from '@/stores/attachmentsStore';
import { useAudioStore } from '@/stores/audioStore';
import { clockLabel } from '@/utils/files';

const props = defineProps<{ noteId: string }>();
const emit = defineEmits<{ command: [command: EditorCommand]; link: []; changed: [] }>();

const attachments = useAttachmentsStore();
const audioStore = useAudioStore();
const libraryInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const recording = ref(false);
const elapsed = ref(0);

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let mime = '';
let startedAt = 0;
let timer = 0;

function holdFocus(event: MouseEvent): void {
  event.preventDefault();
}

async function begin(): Promise<void> {
  if (recorder) return;
  try {
    const opened = await openMicrophone();
    recorder = opened.recorder;
    stream = opened.stream;
    mime = opened.mimeType;
    chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.start();
    startedAt = Date.now();
    elapsed.value = 0;
    timer = window.setInterval(() => {
      elapsed.value = Date.now() - startedAt;
    }, 200);
    recording.value = true;
  } catch {
    pushToast('Não foi possível usar o microfone.');
  }
}

function finish(save: boolean): void {
  const current = recorder;
  const currentStream = stream;
  const started = startedAt;
  const type = mime;
  recording.value = false;
  window.clearInterval(timer);
  recorder = null;
  stream = null;
  if (!current) {
    stopStream(currentStream);
    return;
  }
  current.onstop = () => {
    stopStream(currentStream);
    if (!save) return;
    const duration = Date.now() - started;
    if (duration < 400) {
      pushToast('Gravação curta demais.');
      return;
    }
    const blob = new Blob(chunks, { type: type || 'audio/webm' });
    void audioStore.addClip(props.noteId, blob, duration, type).then((created) => {
      if (created) emit('changed');
    });
  };
  if (current.state !== 'inactive') current.stop();
  else stopStream(currentStream);
}

function onMic(): void {
  if (recording.value) finish(true);
  else void begin();
}

function filesOf(event: Event): File[] {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files) return [];
  const files = [...input.files];
  input.value = '';
  return files;
}

async function addPhotos(files: File[]): Promise<void> {
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

async function pickFiles(event: Event): Promise<void> {
  let added = false;
  for (const file of filesOf(event)) {
    const created = await attachments.addDocument(props.noteId, file);
    if (created) added = true;
  }
  if (added) emit('changed');
}

onBeforeUnmount(() => finish(false));
</script>

<template>
  <div class="fn-dock-bar">
    <EditorToolbar @command="emit('command', $event)" @link="emit('link')">
      <button
        type="button"
        class="fn-tool"
        :data-live="recording ? 'true' : undefined"
        :aria-pressed="recording"
        :aria-label="recording ? 'Parar gravação' : 'Gravar áudio'"
        @mousedown="holdFocus"
        @click="onMic"
      >
        <ion-icon :icon="micOutline" aria-hidden="true" />
        <span v-if="recording" class="fn-rec-time">{{ clockLabel(elapsed) }}</span>
      </button>
      <button type="button" class="fn-tool" aria-label="Adicionar fotografia" @mousedown="holdFocus" @click="pickPhoto">
        <ion-icon :icon="imageOutline" aria-hidden="true" />
      </button>
      <button type="button" class="fn-tool" aria-label="Anexar arquivo" @mousedown="holdFocus" @click="fileInput?.click()">
        <ion-icon :icon="attachOutline" aria-hidden="true" />
      </button>
    </EditorToolbar>
    <input ref="libraryInput" class="fn-sr" type="file" accept="image/*" multiple aria-label="Adicionar fotografia" @change="addPhotos(filesOf($event))" />
    <input ref="fileInput" class="fn-sr" type="file" multiple aria-label="Anexar arquivo" @change="pickFiles" />
  </div>
</template>
