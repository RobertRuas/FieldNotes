import type { Note } from '@/types/entities';
import { groupLabel } from '@/utils/dates';

export type NoteListRow =
  | { kind: 'header'; key: string; height: number; label: string }
  | { kind: 'note'; key: string; height: number; note: Note };

export function buildNoteRows(notes: readonly Note[], today: string): NoteListRow[] {
  const pinned = notes.filter((note) => note.pinned).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    if (note.pinned) continue;
    const bucket = groups.get(note.date) ?? [];
    bucket.push(note);
    groups.set(note.date, bucket);
  }
  const dates = [...groups.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const rows: NoteListRow[] = [];
  if (pinned.length > 0) {
    rows.push({ kind: 'header', key: 'h-pinned', height: 36, label: 'Fixadas' });
    for (const note of pinned) rows.push({ kind: 'note', key: note.id, height: 96, note });
  }
  for (const date of dates) {
    rows.push({ kind: 'header', key: `h-${date}`, height: 36, label: groupLabel(date, today) });
    const items = [...(groups.get(date) ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    for (const note of items) {
      rows.push({ kind: 'note', key: note.id, height: 96, note });
    }
  }
  return rows;
}
