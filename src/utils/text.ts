import type { Note } from '@/types/entities';
import { noteStamp } from '@/utils/dates';
import { escapeHtml, htmlToMultilinePlain, htmlToPlain } from '@/utils/html';

export function hasVisibleContent(title: string, html: string): boolean {
  return title.trim().length > 0 || htmlToPlain(html).length > 0;
}

export function displayTitle(note: Pick<Note, 'createdAt'> & Partial<Pick<Note, 'title'>>): string {
  if (note.title && note.title.trim().length > 0) {
    return note.title.trim();
  }
  return noteStamp(note.createdAt);
}

export function notePreview(note: Pick<Note, 'text'>): string {
  const plain = htmlToMultilinePlain(note.text);
  if (!plain) return '';
  const lines = plain.split('\n').slice(0, 5);
  const truncated = lines.join('\n');
  return truncated.length > 220 ? `${truncated.slice(0, 219)}…` : truncated;
}

export function noteCountLabel(count: number): string {
  if (count === 0) return 'Nenhuma nota';
  if (count === 1) return '1 nota';
  return `${count} notas`;
}

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function searchTokens(query: string): string[] {
  return [...new Set(normalizeSearchText(query.trim()).split(/\s+/).filter(Boolean))];
}

function fold(text: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const piece = text[index].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const char of piece) {
      folded += char;
      map.push(index);
    }
  }
  return { folded, map };
}

function matchRanges(text: string, query: string): Array<[number, number]> {
  const tokens = searchTokens(query);
  if (!text || tokens.length === 0) return [];
  const { folded, map } = fold(text);
  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    let from = 0;
    while (from <= folded.length - token.length) {
      const at = folded.indexOf(token, from);
      if (at < 0) break;
      const start = map[at] ?? 0;
      const end = (map[at + token.length - 1] ?? start) + 1;
      ranges.push([start, end]);
      from = at + token.length;
    }
  }
  ranges.sort((left, right) => left[0] - right[0] || right[1] - left[1]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

export function highlightPlain(text: string, query: string): string {
  if (!text) return '';
  const ranges = matchRanges(text, query);
  if (ranges.length === 0) return escapeHtml(text);
  let html = '';
  let cursor = 0;
  for (const [start, end] of ranges) {
    html += escapeHtml(text.slice(cursor, start));
    html += `<mark class="fn-hit">${escapeHtml(text.slice(start, end))}</mark>`;
    cursor = end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

export function matchNote(note: Note, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const q = normalizeSearchText(trimmed);
  const titleNorm = normalizeSearchText(note.title || '');
  const contentNorm = normalizeSearchText(htmlToPlain(note.text));
  const stampNorm = normalizeSearchText(noteStamp(note.createdAt));

  if (titleNorm.includes(q) || contentNorm.includes(q) || stampNorm.includes(q)) {
    return true;
  }

  const combined = `${titleNorm} ${contentNorm} ${stampNorm}`;
  if (combined.includes(q)) {
    return true;
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    return tokens.every((token) => combined.includes(token));
  }

  return false;
}

export function searchSnippet(note: Pick<Note, 'text'>, query: string): string {
  const plain = htmlToMultilinePlain(note.text).replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  const tokens = searchTokens(query);
  if (tokens.length === 0) return notePreview(note);

  const { folded, map } = fold(plain);
  let index = -1;
  for (const token of tokens) {
    const at = folded.indexOf(token);
    if (at >= 0 && (index < 0 || at < index)) index = at;
  }
  if (index < 0) return notePreview(note);

  const origin = map[index] ?? 0;
  if (origin < 80) return plain.length > 220 ? `${plain.slice(0, 219)}…` : plain;

  const start = Math.max(0, origin - 40);
  const end = Math.min(plain.length, origin + 160);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < plain.length ? '…' : '';
  return `${prefix}${plain.slice(start, end).trim()}${suffix}`;
}

