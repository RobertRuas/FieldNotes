import type { Note } from '@/types/entities';
import { groupLabel } from '@/utils/dates';

export type NoteListRow =
  | { kind: 'header'; key: string; height: number; label: string }
  | { kind: 'note'; key: string; height: number; note: Note };

export function buildNoteRows(notes: readonly Note[], today: string): NoteListRow[] {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const bucket = groups.get(note.date) ?? [];
    bucket.push(note);
    groups.set(note.date, bucket);
  }
  const dates = [...groups.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const rows: NoteListRow[] = [];
  for (const date of dates) {
    rows.push({ kind: 'header', key: `h-${date}`, height: 36, label: groupLabel(date, today) });
    const items = [...(groups.get(date) ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    for (const note of items) {
      rows.push({ kind: 'note', key: note.id, height: 56, note });
    }
  }
  return rows;
}
