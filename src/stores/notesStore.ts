import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { NoteService } from '@/services/NoteService';
import { NotificationService } from '@/services/NotificationService';
import { useAuthStore } from '@/stores/authStore';
import type { Note } from '@/types/entities';
import { pushToast } from '@/composables/useToast';
import { nowIso, todayKey } from '@/utils/dates';
import { buildNoteRows, type NoteListRow } from '@/utils/noteList';

export const useNotesStore = defineStore('notesStore', () => {
  const notes = ref<Note[]>([]);
  const selectedDate = ref(todayKey());
  const viewMode = ref<'calendar' | 'list'>('calendar');

  const listRows = computed<NoteListRow[]>(() => buildNoteRows(notes.value, todayKey()));

  function notesOn(date: string): Note[] {
    return notes.value
      .filter((note) => note.date === date)
      .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
  }

  async function hydrate(): Promise<void> {
    const userId = useAuthStore().userId;
    if (!userId) return;
    await NoteService.restorePending(userId);
    notes.value = await NoteService.list(userId);
  }

  async function find(id: string): Promise<Note | undefined> {
    return notes.value.find((note) => note.id === id) ?? NoteService.get(id);
  }

  async function save(note: Note): Promise<void> {
    const previous = notes.value.find((item) => item.id === note.id) ?? null;
    const index = notes.value.findIndex((item) => item.id === note.id);
    if (index === -1) notes.value.unshift(note);
    else notes.value[index] = note;
    try {
      await NoteService.persist(note);
      await NotificationService.syncReminder(note);
    } catch {
      if (previous) {
        const at = notes.value.findIndex((item) => item.id === note.id);
        if (at === -1) notes.value.unshift(previous);
        else notes.value[at] = previous;
      } else {
        notes.value = notes.value.filter((item) => item.id !== note.id);
      }
      pushToast('Não foi possível salvar neste aparelho.');
      throw new Error('falha-local');
    }
  }

  async function remove(id: string): Promise<void> {
    const current = notes.value.find((item) => item.id === id);
    if (!current) return;
    const tombstone: Note = { ...current, deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' };
    notes.value = notes.value.filter((item) => item.id !== id);
    try {
      await NoteService.persist(tombstone);
      await NotificationService.syncReminder(tombstone);
    } catch {
      notes.value.unshift(current);
      pushToast('Não foi possível salvar neste aparelho.');
      throw new Error('falha-local');
    }
  }

  function setSelectedDate(date: string): void {
    selectedDate.value = date;
  }

  function toggleView(): void {
    viewMode.value = viewMode.value === 'calendar' ? 'list' : 'calendar';
  }

  return {
    notes,
    selectedDate,
    viewMode,
    listRows,
    notesOn,
    hydrate,
    find,
    save,
    remove,
    setSelectedDate,
    toggleView,
  };
});
