<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import AudioClip from '@/components/AudioClip.vue';
import { pushToast } from '@/composables/useToast';
import { openMicrophone, stopStream } from '@/services/platform/recorder';
import { useAudioStore } from '@/stores/audioStore';
import { clockLabel } from '@/utils/files';

const props = defineProps<{ noteId: string; bare?: boolean }>();
const emit = defineEmits<{ changed: [] }>();
const audioStore = useAudioStore();

const recording = ref(false);
const elapsed = ref(0);
const clips = computed(() => audioStore.forNote(props.noteId));

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let mime = '';
let startedAt = 0;
let timer = 0;

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

function onTap(): void {
  if (recording.value) finish(true);
  else void begin();
}

onBeforeUnmount(() => finish(false));
</script>

<template>
  <section v-if="!bare || clips.length > 0" class="fn-media" :class="{ 'is-bare': bare }" aria-label="Áudio">
    <h2 v-if="!bare">Áudio</h2>
    <div v-if="!bare" class="fn-rec">
      <button type="button" class="fn-chip" :aria-pressed="recording" @click="onTap">
        {{ recording ? 'Parar' : 'Toque para gravar' }}
      </button>
    </div>
    <p v-if="recording" class="fn-rec-live" aria-live="polite">
      <i class="fn-rec-dot" aria-hidden="true" />
      {{ clockLabel(elapsed) }}
    </p>
    <div v-if="clips.length > 0" class="fn-clips">
      <AudioClip v-for="clip in clips" :key="clip.id" :clip="clip" @removed="emit('changed')" />
    </div>
  </section>
</template>
