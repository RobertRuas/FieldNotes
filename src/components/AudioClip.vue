<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import TransferLine from '@/components/TransferLine.vue';
import { useAudioStore } from '@/stores/audioStore';
import type { AudioRecording } from '@/types/entities';
import { visibleTransfer } from '@/sync/fileQueue';
import { clockLabel } from '@/utils/files';

const props = defineProps<{ clip: AudioRecording }>();
const emit = defineEmits<{ removed: [] }>();
const audioStore = useAudioStore();
const player = ref<HTMLAudioElement | null>(null);
const url = ref<string | null>(null);
const playing = ref(false);
const position = ref(0);

async function source(): Promise<string | null> {
  if (url.value) return url.value;
  url.value = await audioStore.clipUrl(props.clip);
  return url.value;
}

async function toggle(): Promise<void> {
  const element = player.value;
  const src = await source();
  if (!element || !src) return;
  if (element.src !== src) element.src = src;
  if (playing.value) {
    element.pause();
    playing.value = false;
    return;
  }
  await element.play();
  playing.value = true;
}

function onTime(): void {
  const element = player.value;
  if (!element) return;
  position.value = element.currentTime * 1000;
}

function seek(event: Event): void {
  const element = player.value;
  const input = event.target;
  if (!element || !(input instanceof HTMLInputElement)) return;
  element.currentTime = Number(input.value) / 1000;
  position.value = element.currentTime * 1000;
}

function ended(): void {
  playing.value = false;
  position.value = 0;
}

async function remove(): Promise<void> {
  player.value?.pause();
  await audioStore.remove(props.clip.id);
  emit('removed');
}

onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value);
});
</script>

<template>
  <article class="fn-player">
    <button type="button" class="fn-text-btn" :aria-label="playing ? 'Pausar' : 'Ouvir'" @click="toggle">
      {{ playing ? 'Pausar' : 'Ouvir' }}
    </button>
    <label class="fn-player-bar">
      <span class="fn-sr">Progresso</span>
      <input
        type="range"
        min="0"
        :max="Math.max(clip.durationMs, 1)"
        :value="position"
        @input="seek"
      />
      <small>{{ clockLabel(position) }} / {{ clockLabel(clip.durationMs) }}</small>
    </label>
    <button type="button" class="fn-text-btn" aria-label="Excluir áudio" @click="remove">Excluir</button>
    <TransferLine
      :status="visibleTransfer(clip, audioStore.transferFor(clip.id))"
      @retry="audioStore.retry(clip.id)"
    />
    <audio ref="player" preload="none" @timeupdate="onTime" @ended="ended" />
  </article>
</template>
