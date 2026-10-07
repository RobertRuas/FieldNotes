<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { closeOutline, pauseOutline, playOutline } from 'ionicons/icons';
import SyncMark from '@/components/SyncMark.vue';
import TransferLine from '@/components/TransferLine.vue';
import { useAudioStore } from '@/stores/audioStore';
import type { AudioRecording } from '@/types/entities';
import { transferAsSync, visibleTransfer } from '@/sync/fileQueue';
import { clockLabel } from '@/utils/files';

const props = withDefaults(
  defineProps<{ clip: AudioRecording; label?: string; editable?: boolean }>(),
  { editable: true },
);
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
  <li class="fn-attach-audio">
    <button type="button" class="fn-attach-play" :aria-label="playing ? 'Pausar' : 'Ouvir'" @click="toggle">
      <ion-icon :icon="playing ? pauseOutline : playOutline" aria-hidden="true" />
    </button>
    <span class="fn-attach-name">{{ label || 'Áudio' }}</span>
    <small>{{ clockLabel(position) }}/{{ clockLabel(clip.durationMs) }}</small>
    <SyncMark :status="transferAsSync(visibleTransfer(clip, audioStore.transferFor(clip.id)))" />
    <button v-if="editable" type="button" class="fn-attach-x" aria-label="Excluir áudio" @click="remove">
      <ion-icon :icon="closeOutline" aria-hidden="true" />
    </button>
    <TransferLine
      :status="visibleTransfer(clip, audioStore.transferFor(clip.id))"
      @retry="audioStore.retry(clip.id)"
    />
    <audio ref="player" preload="none" @timeupdate="onTime" @ended="ended" />
  </li>
</template>
