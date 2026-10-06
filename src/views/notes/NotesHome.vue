<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonToolbar } from '@ionic/vue';
import { addOutline, calendarOutline, listOutline } from 'ionicons/icons';
import markUrl from '@/assets/mark.svg';
import CalendarBoard from '@/components/CalendarBoard.vue';
import EmptyState from '@/components/EmptyState.vue';
import NoteCard from '@/components/NoteCard.vue';
import NoteListRow from '@/components/NoteListRow.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import VirtualList from '@/components/VirtualList.vue';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useNotesStore } from '@/stores/notesStore';
import { useSyncStore } from '@/stores/syncStore';
import type { Note } from '@/types/entities';
import { groupLabel, todayKey } from '@/utils/dates';
import { ionElement, scrollIonToTop } from '@/utils/ionic';
import { isRecord } from '@/utils/guards';
import { noteCountLabel } from '@/utils/text';

const router = useRouter();
const notes = useNotesStore();
const collections = useCollectionsStore();
const sync = useSyncStore();
const contentRef = ref<unknown>(null);
const scrollTop = ref(0);
const viewport = ref(640);
const today = todayKey();

const marked = computed(() => notes.notes.map((note) => note.date));
const dayNotes = computed(() => notes.notesOn(notes.selectedDate));
const heading = computed(() => groupLabel(notes.selectedDate, today));
const countLabel = computed(() => noteCountLabel(dayNotes.value.length));
const viewIcon = computed(() => (notes.viewMode === 'calendar' ? listOutline : calendarOutline));
const viewLabel = computed(() => (notes.viewMode === 'calendar' ? 'Mostrar lista' : 'Mostrar calendário'));

function accentFor(note: Note): string | null {
  if (!note.collectionId) return null;
  return collections.items.find((item) => item.id === note.collectionId)?.color ?? null;
}

function prefersReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function measure(): Promise<void> {
  const element = ionElement(contentRef.value);
  if (!element?.getScrollElement) return;
  const scroll = await element.getScrollElement();
  viewport.value = scroll.clientHeight || 640;
}

function onScroll(event: Event): void {
  const value = readScrollTop(event);
  if (value !== null) scrollTop.value = value;
}

function readScrollTop(event: Event): number | null {
  if (!('detail' in event)) return null;
  const detail = (event as CustomEvent<unknown>).detail;
  if (!isRecord(detail) || typeof detail.scrollTop !== 'number') return null;
  return detail.scrollTop;
}

function selectDate(date: string): void {
  notes.setSelectedDate(date);
  void scrollIonToTop(contentRef.value, prefersReduced() ? 0 : 180);
}

function toggleView(): void {
  notes.toggleView();
  void scrollIonToTop(contentRef.value, prefersReduced() ? 0 : 180);
}

function createNote(): void {
  const date = notes.viewMode === 'calendar' ? notes.selectedDate : today;
  void router.push({ name: 'editor', params: { noteId: 'nova' }, query: { date } });
}

function openNote(id: string): void {
  void router.push({ name: 'editor', params: { noteId: id } });
}

onMounted(() => {
  void measure();
});
</script>

<template>
  <ion-page @ionViewDidEnter="measure">
    <ion-header class="fn-header">
      <ion-toolbar>
        <div class="fn-titlebar">
          <div class="fn-brand">
            <img class="fn-mark-img" :src="markUrl" alt="" width="28" height="28" />
            <h1>Notas</h1>
          </div>
          <ion-button
            fill="clear"
            class="fn-icon-btn"
            v-aria="{ label: viewLabel, pressed: notes.viewMode === 'list' }"
            @click="toggleView"
          >
            <ion-icon :icon="viewIcon" aria-hidden="true" />
          </ion-button>
          <button type="button" class="fn-plus" aria-label="Nova nota" @click="createNote">
            <ion-icon :icon="addOutline" aria-hidden="true" />
          </button>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content ref="contentRef" class="fn-page" :scroll-events="true" fullscreen @ion-scroll="onScroll">
      <p v-if="sync.bootError" class="fn-boot" role="alert">{{ sync.bootError }}</p>
      <SyncStatus />
      <template v-if="notes.viewMode === 'calendar'">
        <CalendarBoard :selected="notes.selectedDate" :today="today" :marked="marked" @select="selectDate" />
        <div :key="notes.selectedDate" class="fn-fade">
          <div class="fn-day-head">
            <h2>{{ heading }}</h2>
            <p>{{ countLabel }}</p>
          </div>
          <EmptyState
            v-if="dayNotes.length === 0"
            title="Nada neste dia"
            body="Uma observação nova aparece aqui, mesmo sem rede."
          />
          <div v-else class="fn-notes">
            <NoteCard
              v-for="note in dayNotes"
              :key="note.id"
              :note="note"
              :accent="accentFor(note)"
              @open="openNote"
            />
          </div>
        </div>
      </template>
      <template v-else>
        <EmptyState
          v-if="notes.listRows.length === 0"
          title="Nenhuma nota ainda"
          <body="Toque em + para criar uma nota. Ela fica neste aparelho na hora."
        />
        <VirtualList v-else :rows="notes.listRows" :scroll-top="scrollTop" :viewport="viewport">
          <template #row="{ row }">
            <NoteListRow :row="row" @open="openNote" />
          </template>
        </VirtualList>
      </template>
    </ion-content>
  </ion-page>
</template>
