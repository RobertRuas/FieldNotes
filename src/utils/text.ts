import type { Note } from '@/types/entities';
import { htmlToPlain } from '@/utils/html';

export function hasVisibleContent(title: string, html: string): boolean {
  return title.trim().length > 0 || htmlToPlain(html).length > 0;
}

export function displayTitle(note: Pick<Note, 'title' | 'text'>): string {
  const title = note.title.trim();
  if (title) return title;
  const plain = htmlToPlain(note.text);
  if (!plain) return 'Sem título';
  return plain.length > 80 ? `${plain.slice(0, 79)}…` : plain;
}

export function notePreview(note: Pick<Note, 'title' | 'text'>): string {
  if (!note.title.trim()) return '';
  const plain = htmlToPlain(note.text);
  if (!plain) return '';
  return plain.length > 140 ? `${plain.slice(0, 139)}…` : plain;
}

export function noteCountLabel(count: number): string {
  if (count === 0) return 'Nenhuma nota';
  if (count === 1) return '1 nota';
  return `${count} notas`;
}
