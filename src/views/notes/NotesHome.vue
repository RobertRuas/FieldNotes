<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/vue';
import {
  addOutline,
  calendarOutline,
  closeCircleOutline,
  closeOutline,
  listOutline,
  searchOutline,
} from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import CalendarBoard from '@/components/CalendarBoard.vue';
import EmptyState from '@/components/EmptyState.vue';
import NoteCard from '@/components/NoteCard.vue';
import NoteListRow from '@/components/NoteListRow.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import VirtualList from '@/components/VirtualList.vue';
import { primeKeyboard } from '@/composables/useKeyboardInset';
import { pushToast } from '@/composables/useToast';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useNotesStore } from '@/stores/notesStore';
import { useSyncStore } from '@/stores/syncStore';
import type { Note } from '@/types/entities';
import { groupLabel, todayKey } from '@/utils/dates';
import { htmlToMultilinePlain } from '@/utils/html';
import { ionElement, scrollIonToTop } from '@/utils/ionic';
import { isRecord } from '@/utils/guards';
import { matchNote, noteCountLabel } from '@/utils/text';

const router = useRouter();
const notes = useNotesStore();
const collections = useCollectionsStore();
const sync = useSyncStore();
const contentRef = ref<unknown>(null);
const scrollTop = ref(0);
const viewport = ref(640);
const today = todayKey();

const isSearchOpen = ref(false);
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

const isSearchActive = computed(() => isSearchOpen.value && searchQuery.value.trim().length > 0);

const searchResults = computed(() => {
  const query = searchQuery.value.trim();
  if (!query) return [];
  return notes.notes
    .filter((note) => matchNote(note, query))
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
});

const searchCountLabel = computed(() => {
  const count = searchResults.value.length;
  if (count === 0) return 'Nenhum resultado';
  if (count === 1) return '1 resultado';
  return `${count} resultados`;
});

const marked = computed(() => notes.notes.map((note) => note.date));
const dayNotes = computed(() => notes.notesOn(notes.selectedDate));
const pinnedNotes = computed(() => notes.pinnedNotes);
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
  if (window.matchMedia('(pointer: coarse)').matches) primeKeyboard();
  const date = notes.viewMode === 'calendar' ? notes.selectedDate : today;
  void router.push({ name: 'editor', params: { noteId: 'nova' }, query: { date } });
}

let copiedId = '';
let pressTimer = 0;
let pressNote: Note | null = null;
let pressX = 0;
let pressY = 0;
let lastCopy = 0;
let copyPending = false;

function plainNote(note: Note): string {
  const body = htmlToMultilinePlain(note.text).trim();
  const title = note.title.trim();
  if (title && body) return `${title}\n${body}`;
  return body || title;
}

function writePlain(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(area);
  area.focus({ preventScroll: true });
  area.select();
  area.setSelectionRange(0, area.value.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    area.remove();
  }
  return copied;
}

function holdCopy(note: Note): void {
  copiedId = note.id;
  window.setTimeout(() => {
    if (copiedId === note.id) copiedId = '';
  }, 900);
}

function markCopied(note: Note): void {
  if (Date.now() - lastCopy < 700) return;
  lastCopy = Date.now();
  copyPending = false;
  holdCopy(note);
  pushToast('Texto copiado');
}

function copyNoteText(note: Note, trusted = true): void {
  if (Date.now() - lastCopy < 700) return;
  holdCopy(note);
  const text = plainNote(note);
  if (!text) {
    lastCopy = Date.now();
    pushToast('Nota sem texto');
    return;
  }
  if (trusted && writePlain(text)) {
    markCopied(note);
    return;
  }
  const clip = navigator.clipboard;
  if (!clip?.writeText) {
    if (writePlain(text)) markCopied(note);
    else if (trusted) pushToast('Não foi possível copiar');
    else copyPending = true;
    return;
  }
  void clip.writeText(text).then(
    () => markCopied(note),
    () => {
      if (writePlain(text)) markCopied(note);
      else if (trusted) pushToast('Não foi possível copiar');
      else copyPending = true;
    },
  );
}

function clearPress(): void {
  window.clearTimeout(pressTimer);
  pressTimer = 0;
  pressNote = null;
}

function beginPress(note: Note, event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  clearPress();
  copyPending = false;
  pressNote = note;
  pressX = event.clientX;
  pressY = event.clientY;
  const target = event.currentTarget;
  if (target instanceof Element) {
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* o alvo pode já ter soltado o ponteiro */
    }
  }
  pressTimer = window.setTimeout(() => {
    pressTimer = 0;
    if (pressNote) copyNoteText(pressNote, false);
  }, 450);
}

function movePress(event: PointerEvent): void {
  if (!pressTimer) return;
  if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > 28) clearPress();
}

function endPress(event: PointerEvent): void {
  const note = pressNote;
  const pending = copyPending;
  const waiting = pressTimer !== 0;
  const armed = note !== null && !waiting && copiedId === note.id && Date.now() - lastCopy >= 700;
  if (event.type === 'pointercancel' || waiting) {
    clearPress();
    copyPending = false;
    return;
  }
  clearPress();
  if (note && (pending || armed)) copyNoteText(note, true);
}

function beginRow(row: { kind: string; note?: Note }, event: PointerEvent): void {
  if (row.kind !== 'note' || !row.note) return;
  beginPress(row.note, event);
}

function openNote(id: string): void {
  if (copiedId === id) {
    copiedId = '';
    return;
  }
  void router.push({ name: 'editor', params: { noteId: id } });
}

async function openSearch(): Promise<void> {
  isSearchOpen.value = true;
  await nextTick();
  searchInputRef.value?.focus();
}

function clearQuery(): void {
  searchQuery.value = '';
  searchInputRef.value?.focus();
}

function closeSearch(): void {
  searchQuery.value = '';
  isSearchOpen.value = false;
}

onMounted(() => {
  void measure();
});
</script>

<template>
  <ion-page @ionViewDidEnter="measure">
    <AppHeader title="Notas" :searching="isSearchOpen">
      <ion-button
        v-if="!isSearchOpen"
        fill="clear"
        class="fn-icon-btn"
        v-aria="{ label: viewLabel, pressed: notes.viewMode === 'list' }"
        @click="toggleView"
      >
        <ion-icon :icon="viewIcon" aria-hidden="true" />
      </ion-button>
      <div class="fn-search-wrap" :class="{ 'is-expanded': isSearchOpen }">
        <button
          v-if="!isSearchOpen"
          type="button"
          class="fn-icon-btn fn-search-trigger"
          aria-label="Buscar notas"
          @click="openSearch"
        >
          <ion-icon :icon="searchOutline" aria-hidden="true" />
        </button>
        <div v-else class="fn-search-field">
          <ion-icon :icon="searchOutline" class="fn-search-field-icon" aria-hidden="true" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="search"
            class="fn-search-input"
            placeholder="Buscar por título ou conteúdo..."
            aria-label="Buscar notas por título ou conteúdo"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="none"
            spellcheck="false"
            @keydown.esc="closeSearch"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="fn-search-btn fn-search-clear"
            aria-label="Limpar texto"
            @click.stop="clearQuery"
          >
            <ion-icon :icon="closeCircleOutline" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="fn-search-btn fn-search-close"
            aria-label="Fechar busca"
            @click.stop="closeSearch"
          >
            <ion-icon :icon="closeOutline" aria-hidden="true" />
          </button>
        </div>
      </div>
      <button type="button" class="fn-plus" aria-label="Nova nota" @click="createNote">
        <ion-icon :icon="addOutline" aria-hidden="true" />
      </button>
    </AppHeader>
    <ion-content ref="contentRef" class="fn-page" :scroll-events="true" @ion-scroll="onScroll">
      <p v-if="sync.bootError" class="fn-boot" role="alert">{{ sync.bootError }}</p>
      <SyncStatus />
      <template v-if="isSearchActive">
        <div class="fn-fade">
          <div class="fn-day-head">
            <h2>Resultados</h2>
            <p class="fn-search-count" role="status" aria-live="polite">{{ searchCountLabel }}</p>
          </div>
          <EmptyState
            v-if="searchResults.length === 0"
            title="Nenhuma nota encontrada"
            body="Nenhuma nota corresponde aos termos digitados. Tente outras palavras ou trechos."
          />
          <div v-else class="fn-notes">
            <NoteCard
              v-for="note in searchResults"
              :key="note.id"
              :note="note"
              :accent="accentFor(note)"
              :query="searchQuery"
              @open="openNote"
              @press="beginPress(note, $event)"
              @move="movePress"
              @lift="endPress"
              @copy="copyNoteText(note)"
            />
          </div>
        </div>
      </template>
      <template v-else-if="notes.viewMode === 'calendar'">
        <CalendarBoard :selected="notes.selectedDate" :today="today" :marked="marked" @select="selectDate" />
        <section v-if="pinnedNotes.length > 0" class="fn-pinned">
          <div class="fn-day-head">
            <h2>Fixadas</h2>
          </div>
          <div class="fn-notes">
            <NoteCard
              v-for="note in pinnedNotes"
              :key="note.id"
              :note="note"
              :accent="accentFor(note)"
              @open="openNote"
              @press="beginPress(note, $event)"
              @move="movePress"
              @lift="endPress"
              @copy="copyNoteText(note)"
            />
          </div>
        </section>
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
              @press="beginPress(note, $event)"
              @move="movePress"
              @lift="endPress"
              @copy="copyNoteText(note)"
            />
          </div>
        </div>
      </template>
      <template v-else>
        <EmptyState
          v-if="notes.listRows.length === 0"
          title="Nenhuma nota ainda"
          body="Toque em + para criar uma nota. Ela fica neste aparelho na hora."
        />
        <VirtualList v-else :rows="notes.listRows" :scroll-top="scrollTop" :viewport="viewport">
          <template #row="{ row }">
            <NoteListRow
              :row="row"
              @open="openNote"
              @press="beginRow(row, $event)"
              @move="movePress"
              @lift="endPress"
              @copy="row.kind === 'note' && row.note ? copyNoteText(row.note) : undefined"
            />
          </template>
        </VirtualList>
      </template>
    </ion-content>
  </ion-page>
</template>
