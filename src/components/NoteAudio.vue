<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import AudioClip from '@/components/AudioClip.vue';
import { pushToast } from '@/composables/useToast';
import { openMicrophone, stopStream } from '@/services/platform/recorder';
import { useAudioStore } from '@/stores/audioStore';
import { clockLabel } from '@/utils/files';

const props = defineProps<{ noteId: string }>();
const emit = defineEmits<{ changed: [] }>();
const audioStore = useAudioStore();

const holding = ref(false);
const tapping = ref(false);
const elapsed = ref(0);
const clips = computed(() => audioStore.forNote(props.noteId));

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let mime = '';
let startedAt = 0;
let timer = 0;
let mode: 'hold' | 'tap' | null = null;
let discard = false;
let holdPressed = false;

async function begin(next: 'hold' | 'tap'): Promise<void> {
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
    mode = next;
    holding.value = next === 'hold';
    tapping.value = next === 'tap';
    // Soltar antes do microfone abrir ainda encerra a gravação.
    if (next === 'hold' && !holdPressed) finish(true);
  } catch {
    pushToast('Não foi possível usar o microfone.');
  }
}

function finish(save: boolean): void {
  const current = recorder;
  const currentStream = stream;
  const started = startedAt;
  const type = mime;
  const keep = save && !discard;
  discard = false;
  holding.value = false;
  tapping.value = false;
  mode = null;
  window.clearInterval(timer);
  recorder = null;
  stream = null;
  if (!current) {
    stopStream(currentStream);
    return;
  }
  current.onstop = () => {
    stopStream(currentStream);
    if (!keep) return;
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

function onHoldDown(event: PointerEvent): void {
  if (tapping.value) return;
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
  discard = false;
  holdPressed = true;
  void begin('hold');
}

function onHoldUp(): void {
  holdPressed = false;
  if (mode !== 'hold') return;
  finish(true);
}

function cancelHold(): void {
  if (mode !== 'hold' && mode !== 'tap') return;
  discard = true;
  finish(false);
}

function onTap(): void {
  if (holding.value) return;
  if (tapping.value) finish(true);
  else void begin('tap');
}

onBeforeUnmount(() => {
  discard = true;
  finish(false);
});
</script>

<template>
  <section class="fn-media" aria-label="Áudio">
    <h2>Áudio</h2>
    <div class="fn-rec">
      <button
        type="button"
        class="fn-chip"
        :aria-pressed="holding"
        aria-label="Segurar para gravar"
        @pointerdown="onHoldDown"
        @pointerup="onHoldUp"
        @pointercancel="cancelHold"
        @contextmenu.prevent
      >
        Segurar para gravar
      </button>
      <button type="button" class="fn-chip" :aria-pressed="tapping" @click="onTap">
        {{ tapping ? 'Parar' : 'Toque para gravar' }}
      </button>
      <button v-if="holding || tapping" type="button" class="fn-text-btn" @click="cancelHold">Cancelar</button>
    </div>
    <p v-if="holding || tapping" class="fn-rec-live" aria-live="polite">
      <i class="fn-rec-dot" aria-hidden="true" />
      {{ clockLabel(elapsed) }}
    </p>
    <p v-if="clips.length === 0" class="fn-muted">Nenhum áudio nesta nota.</p>
    <div v-else class="fn-clips">
      <AudioClip v-for="clip in clips" :key="clip.id" :clip="clip" @removed="emit('changed')" />
    </div>
  </section>
</template>
