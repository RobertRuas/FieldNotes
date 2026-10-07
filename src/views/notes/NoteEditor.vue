<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { alarmOutline, checkmarkOutline, closeOutline, createOutline, ellipsisHorizontal, trashOutline } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import EditorDock from '@/components/EditorDock.vue';
import NoteAudio from '@/components/NoteAudio.vue';
import NoteFiles from '@/components/NoteFiles.vue';
import NotePhotos from '@/components/NotePhotos.vue';
import NoteTaskList from '@/components/NoteTaskList.vue';
import RichTextEditor from '@/components/RichTextEditor.vue';
import SyncMark from '@/components/SyncMark.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { editorKey, type EditorApi, type EditorCommand } from '@/composables/editorContext';
import { useAutosave } from '@/composables/useAutosave';
import { releaseKeyboard, useKeyboardInset } from '@/composables/useKeyboardInset';
import { useAttachmentsStore } from '@/stores/attachmentsStore';
import { useAudioStore } from '@/stores/audioStore';
import { useAuthStore } from '@/stores/authStore';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useNotesStore } from '@/stores/notesStore';
import { useTasksStore } from '@/stores/tasksStore';
import type { Note } from '@/types/entities';
import {
  fromLocalDateTimeInput,
  isDateKey,
  noteStamp,
  nowIso,
  reminderLabel,
  toLocalDateTimeInput,
  todayKey,
} from '@/utils/dates';
import { clearEditorBackup, writeEditorBackup } from '@/utils/editorBackup';
import { normalizeUrl } from '@/utils/html';
import { createId } from '@/utils/id';
import { readIonText } from '@/utils/ionic';
import { hasVisibleContent } from '@/utils/text';

interface SheetButton {
  text: string;
  role?: 'cancel' | 'destructive';
  handler?: () => void;
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const notes = useNotesStore();
const collections = useCollectionsStore();
const tasks = useTasksStore();
const attachmentStore = useAttachmentsStore();
const audioStore = useAudioStore();
const keyboard = useKeyboardInset();
const editorApi = ref<EditorApi | null>(null);
provide(editorKey, editorApi);

const noteIdRef = ref('');
const createdAtRef = ref(nowIso());
const title = ref('');
const pinned = ref(false);
const favorite = ref(false);
const text = ref('');
const dateKey = ref(todayKey());
const collectionId = ref<string | null>(null);
const reminderAt = ref<string | null>(null);
const attachments = ref<string[]>([]);
const photos = ref<string[]>([]);
const documents = ref<string[]>([]);
const audio = ref<string[]>([]);
const taskList = ref<{ focusNew: () => Promise<void> } | null>(null);
const persisted = ref(false);
const missing = ref(false);
const isEditing = ref(route.params.noteId === 'nova');
const revision = ref(0);
let discarding = false;

const linkOpen = ref(false);
const linkDraft = ref('');
const reminderOpen = ref(false);
const reminderDraft = ref('');
const sheetOpen = ref(false);
const collectionOpen = ref(false);
const creatingCollection = ref(false);
const newCollectionOpen = ref(false);
const newCollectionName = ref('');

const normalizedLink = computed(() => normalizeUrl(linkDraft.value));
const linkHint = computed(() =>
  linkDraft.value.trim() && !normalizedLink.value ? 'Use um endereço http, https ou e-mail.' : '',
);
const dateLabel = computed(() => noteStamp(createdAtRef.value));
const noteSync = computed(() => notes.notes.find((item) => item.id === noteIdRef.value)?.syncStatus ?? 'pending');
const collectionLabel = computed(() => {
  if (!collectionId.value) return 'Coleção';
  return collections.items.find((item) => item.id === collectionId.value)?.name ?? 'Coleção';
});
const reminderText = computed(() => (reminderAt.value ? reminderLabel(reminderAt.value) : 'Lembrete'));
const hasAttachments = computed(() => photos.value.length + documents.value.length + audio.value.length > 0);

const deleteButtons: SheetButton[] = [
  { text: 'Excluir nota', role: 'destructive', handler: () => { void removeNote(); } },
  { text: 'Cancelar', role: 'cancel' },
];

const collectionButtons = computed<SheetButton[]>(() => [
  ...collections.ordered.map((item) => ({
    text: item.name,
    handler: () => {
      collectionId.value = item.id;
      touch();
    },
  })),
  {
    text: 'Nova coleção',
    handler: () => {
      creatingCollection.value = true;
    },
  },
  {
    text: 'Sem coleção',
    handler: () => {
      collectionId.value = null;
      touch();
    },
  },
  { text: 'Cancelar', role: 'cancel' },
]);

function applyMedia(): void {
  const id = noteIdRef.value;
  const files = attachmentStore.forNote(id);
  photos.value = files.filter((item) => item.kind === 'photo').map((item) => item.id);
  documents.value = files.filter((item) => item.kind !== 'photo').map((item) => item.id);
  attachments.value = files.map((item) => item.id);
  audio.value = audioStore.forNote(id).map((item) => item.id);
}

function shouldPersist(): boolean {
  return (
    hasVisibleContent(title.value, text.value) ||
    collectionId.value !== null ||
    reminderAt.value !== null ||
    tasks.forNote(noteIdRef.value).length > 0 ||
    photos.value.length > 0 ||
    documents.value.length > 0 ||
    audio.value.length > 0
  );
}

function snapshot(userId: string): Note {
  return {
    id: noteIdRef.value,
    userId,
    title: title.value,
    text: text.value,
    date: dateKey.value,
    collectionId: collectionId.value,
    reminderAt: reminderAt.value,
    pinned: pinned.value,
    favorite: favorite.value,
    attachments: [...attachments.value],
    photos: [...photos.value],
    documents: [...documents.value],
    audio: [...audio.value],
    tasks: tasks.forNote(noteIdRef.value).map((task) => task.id),
    createdAt: createdAtRef.value,
    updatedAt: nowIso(),
    deletedAt: null,
    syncStatus: 'pending',
  };
}

function rememberLocal(note: Note): void {
  writeEditorBackup({
    id: note.id,
    userId: note.userId,
    title: note.title,
    text: note.text,
    date: note.date,
    collectionId: note.collectionId,
    reminderAt: note.reminderAt,
    updatedAt: note.updatedAt,
  });
}

async function saveCurrent(): Promise<void> {
  if (discarding) return;
  const userId = auth.userId;
  if (!userId || !noteIdRef.value) return;
  if (!persisted.value && !shouldPersist()) return;
  const note = snapshot(userId);
  rememberLocal(note);
  await notes.save(note);
  persisted.value = true;
  if (route.params.noteId === 'nova') {
    window.history.replaceState(window.history.state, '', `/nota/${note.id}`);
    route.params.noteId = note.id;
  }
  const unchanged =
    title.value === note.title &&
    text.value === note.text &&
    dateKey.value === note.date &&
    collectionId.value === note.collectionId &&
    reminderAt.value === note.reminderAt;
  if (unchanged) clearEditorBackup(note.id);
}

const autosave = useAutosave(saveCurrent);

function touch(): void {
  const userId = auth.userId;
  if (!userId || !noteIdRef.value) return;
  rememberLocal(snapshot(userId));
  if (!persisted.value) {
    if (shouldPersist()) void autosave.kick();
    return;
  }
  autosave.schedule();
}

async function load(id: string): Promise<void> {
  const note = await notes.find(id);
  if (!note) {
    missing.value = true;
    return;
  }
  missing.value = false;
  persisted.value = true;
  noteIdRef.value = note.id;
  createdAtRef.value = note.createdAt;
  title.value = note.title;
  text.value = note.text;
  dateKey.value = note.date;
  collectionId.value = note.collectionId;
  reminderAt.value = note.reminderAt;
  pinned.value = note.pinned === true;
  favorite.value = note.favorite === true;
  attachments.value = [...note.attachments];
  photos.value = [...note.photos];
  documents.value = [...note.documents];
  audio.value = [...note.audio];
  applyMedia();
  revision.value += 1;
}

async function onMedia(): Promise<void> {
  applyMedia();
  touch();
  await autosave.flush();
}

function onText(value: string): void {
  text.value = value;
  touch();
}

function onCommand(command: EditorCommand): void {
  // O checklist abre a tarefa de verdade, o mesmo registro da aba Tarefas.
  if (command === 'check') {
    void taskList.value?.focusNew();
    return;
  }
  editorApi.value?.run(command);
}

function openLink(): void {
  editorApi.value?.rememberRange();
  linkDraft.value = '';
  linkOpen.value = true;
}

function onLinkInput(event: Event): void {
  linkDraft.value = readIonText(event);
}

function confirmLink(): void {
  const url = normalizedLink.value;
  if (!url) return;
  editorApi.value?.insertLink(url);
  linkOpen.value = false;
  linkDraft.value = '';
}

function openReminder(): void {
  reminderDraft.value = toLocalDateTimeInput(reminderAt.value);
  reminderOpen.value = true;
}

function setReminderDraft(date: Date): void {
  reminderDraft.value = toLocalDateTimeInput(date.toISOString());
}

function remindInHours(hours: number): void {
  setReminderDraft(new Date(Date.now() + hours * 60 * 60 * 1000));
}

function remindOnMorning(daysAhead: number): void {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(9, 0, 0, 0);
  setReminderDraft(date);
}

function onReminderInput(event: Event): void {
  const target = event.target;
  reminderDraft.value = target instanceof HTMLInputElement ? target.value : '';
}

function confirmReminder(): void {
  reminderAt.value = fromLocalDateTimeInput(reminderDraft.value);
  reminderOpen.value = false;
  touch();
}

function clearReminder(): void {
  reminderAt.value = null;
  reminderDraft.value = '';
  reminderOpen.value = false;
  touch();
}

function onCollectionName(event: Event): void {
  newCollectionName.value = readIonText(event);
}

function onCollectionDismiss(): void {
  collectionOpen.value = false;
  if (!creatingCollection.value) return;
  creatingCollection.value = false;
  newCollectionName.value = '';
  newCollectionOpen.value = true;
}

async function confirmNewCollection(): Promise<void> {
  const created = await collections.add(newCollectionName.value);
  newCollectionOpen.value = false;
  newCollectionName.value = '';
  if (!created) return;
  collectionId.value = created.id;
  touch();
}

async function leave(): Promise<void> {
  await autosave.flush();
  if (window.history.length > 1) router.back();
  else await router.replace('/notas');
}

async function removeNote(): Promise<void> {
  discarding = true;
  autosave.cancel();
  clearEditorBackup(noteIdRef.value);
  if (persisted.value) await notes.remove(noteIdRef.value);
  await router.replace('/notas');
}

function onHide(): void {
  if (document.visibilityState === 'hidden' && !discarding) void autosave.flush();
}

onBeforeRouteLeave(async () => {
  if (discarding) return;
  await autosave.flush();
});

function focusComposer(): void {
  if (route.params.noteId !== 'nova' || missing.value || !isEditing.value) return;
  editorApi.value?.focus();
  if (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) {
    releaseKeyboard();
  }
}

function startEditing(): void {
  isEditing.value = true;
  void nextTick(() => editorApi.value?.focus());
}

async function finishEditing(): Promise<void> {
  await autosave.flush();
  isEditing.value = false;
  // Tira o foco do elemento para recolher o teclado no mobile
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

onMounted(async () => {
  const param = route.params.noteId;
  const id = typeof param === 'string' ? param : '';
  if (id && id !== 'nova') {
    isEditing.value = false;
    await load(id);
  } else {
    isEditing.value = true;
    noteIdRef.value = createId();
    const queryDate = typeof route.query.date === 'string' ? route.query.date : '';
    dateKey.value = isDateKey(queryDate) ? queryDate : todayKey();
    createdAtRef.value = nowIso();
    revision.value += 1;
  }
  document.addEventListener('visibilitychange', onHide);
  await nextTick();
  focusComposer();
});

function onEnter(): void {
  focusComposer();
}

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onHide);
});
</script>

<template>
  <ion-page :class="{ 'is-typing': keyboard > 0 && isEditing }" @ionViewDidEnter="onEnter">
    <AppHeader :title="dateLabel" back @back="leave">
      <template v-if="persisted" #beside>
        <SyncMark :status="noteSync" />
      </template>
      <ion-button
        v-if="persisted && !isEditing"
        fill="clear"
        class="fn-icon-btn"
        v-aria="'Editar nota'"
        @click="startEditing"
      >
        <ion-icon :icon="createOutline" aria-hidden="true" />
      </ion-button>
      <ion-button
        v-if="persisted && isEditing"
        fill="clear"
        class="fn-icon-btn"
        v-aria="'Salvar nota'"
        @click="finishEditing"
      >
        <ion-icon :icon="checkmarkOutline" aria-hidden="true" />
      </ion-button>
      <ion-button v-if="persisted" fill="clear" class="fn-icon-btn" v-aria="'Opções da nota'" @click="sheetOpen = true">
        <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
      </ion-button>
    </AppHeader>
    <ion-content class="fn-page fn-editor-scroll" :fullscreen="false">
      <p v-if="missing" class="fn-boot" role="alert">Nota não encontrada.</p>
      <template v-else>
        <SyncStatus />
        <div class="fn-meta">
          <button type="button" class="fn-chip" :disabled="!isEditing" @click="isEditing && (collectionOpen = true)">{{ collectionLabel }}</button>
          <button type="button" class="fn-chip fn-remind-chip" :disabled="!isEditing" @click="isEditing && openReminder()">
            <ion-icon :icon="alarmOutline" aria-hidden="true" />
            {{ reminderText }}
          </button>
        </div>
        <div class="fn-note-sheet" :class="{ 'is-readonly': !isEditing }">
          <RichTextEditor :model-value="text" :revision="revision" :editable="isEditing" @update:model-value="onText" />
          <NoteTaskList
            v-if="noteIdRef"
            ref="taskList"
            :note-id="noteIdRef"
            :collection-id="collectionId"
            :date="dateKey"
            :editable="isEditing"
            @changed="touch"
          />
          <div v-if="noteIdRef && hasAttachments" class="fn-attachments">
            <NoteAudio bare :note-id="noteIdRef" :editable="isEditing" @changed="onMedia" />
            <NotePhotos bare :note-id="noteIdRef" :editable="isEditing" @changed="onMedia" />
            <NoteFiles bare :note-id="noteIdRef" :editable="isEditing" @changed="onMedia" />
          </div>
        </div>
      </template>
    </ion-content>
    <ion-footer v-if="!missing && isEditing" class="fn-dock">
      <EditorDock
        v-if="noteIdRef"
        :note-id="noteIdRef"
        @command="onCommand"
        @link="openLink"
        @changed="onMedia"
      />
    </ion-footer>
    <ion-modal :is-open="linkOpen" @didDismiss="linkOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Link</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="linkOpen = false">Fechar</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div class="fn-modal-body">
          <ion-input
            label="Endereço"
            label-placement="stacked"
            v-aria="'Endereço do link'"
            inputmode="url"
            :value="linkDraft"
            @ionInput="onLinkInput"
          />
          <p v-if="linkHint" class="fn-hint">{{ linkHint }}</p>
          <ion-button expand="block" :disabled="!normalizedLink" @click="confirmLink">Inserir link</ion-button>
        </div>
      </ion-content>
    </ion-modal>
    <ion-modal
      class="fn-remind-modal"
      :is-open="reminderOpen"
      :breakpoints="[0, 0.42]"
      :initial-breakpoint="0.42"
      handle
      @didDismiss="reminderOpen = false"
    >
      <ion-content>
        <div class="fn-modal-body fn-remind-sheet">
          <div class="fn-modal-bar">
            <button type="button" class="fn-icon-btn" aria-label="Fechar" @click="reminderOpen = false">
              <ion-icon :icon="closeOutline" aria-hidden="true" />
            </button>
            <strong>Lembrete</strong>
            <button type="button" class="fn-icon-btn" aria-label="Guardar lembrete" @click="confirmReminder">
              <ion-icon :icon="checkmarkOutline" aria-hidden="true" />
            </button>
          </div>
          <div class="fn-remind-presets">
            <button type="button" class="fn-chip" @click="remindInHours(1)">1 h</button>
            <button type="button" class="fn-chip" @click="remindOnMorning(1)">Amanhã</button>
            <button type="button" class="fn-chip" @click="remindOnMorning(7)">Semana</button>
          </div>
          <div class="fn-remind-when">
            <input
              id="fn-reminder"
              class="fn-native-time"
              type="datetime-local"
              aria-label="Data e hora do lembrete"
              :value="reminderDraft"
              @input="onReminderInput"
            />
            <button
              v-if="reminderAt || reminderDraft"
              type="button"
              class="fn-icon-btn is-danger"
              aria-label="Remover lembrete"
              @click="clearReminder"
            >
              <ion-icon :icon="trashOutline" aria-hidden="true" />
            </button>
          </div>
        </div>
      </ion-content>
    </ion-modal>
    <ion-action-sheet
      :is-open="sheetOpen"
      header="Nota"
      :buttons="deleteButtons"
      @didDismiss="sheetOpen = false"
    />
    <ion-action-sheet
      :is-open="collectionOpen"
      header="Coleção"
      :buttons="collectionButtons"
      @didDismiss="onCollectionDismiss"
    />
    <ion-modal :is-open="newCollectionOpen" @didDismiss="newCollectionOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Nova coleção</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="newCollectionOpen = false">Fechar</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <form class="fn-modal-body" @submit.prevent="confirmNewCollection">
          <ion-input
            label="Nome"
            label-placement="stacked"
            v-aria="'Nome da nova coleção'"
            :value="newCollectionName"
            @ionInput="onCollectionName"
          />
          <ion-button type="submit" expand="block" :disabled="newCollectionName.trim().length === 0">
            Criar coleção
          </ion-button>
        </form>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>
