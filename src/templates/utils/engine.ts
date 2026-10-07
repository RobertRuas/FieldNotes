import type { NoteTemplate, TemplateVariable } from '@/templates/types';
import { isDateKey } from '@/utils/dates';
import { escapeHtml } from '@/utils/html';
import { activeVariables } from '@/templates/utils/variables';

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const KEY = /^[\p{L}_][\p{L}\p{N}_]{0,39}$/u;

export function formatDateAnswer(value: string): string {
  if (!isDateKey(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year.slice(2)}`;
}

export function formatAnswer(variable: TemplateVariable, value: string): string {
  if (variable.type === 'date') return formatDateAnswer(value);
  return value;
}

export function answersForRender(template: NoteTemplate, answers: Record<string, string>): Record<string, string> {
  const active = new Set(activeVariables(template, answers).map((variable) => variable.key));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (active.has(key)) out[key] = value;
  }
  return out;
}

export function plainNoteText(value: string): string {
  return value
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export function templateNoteHtml(value: string): string {
  const lines = plainNoteText(value).split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) return '<p><br></p>';
  return `<p>${lines.map((line) => escapeHtml(line)).join('<br>')}</p>`;
}

export function renderTemplate(content: string, variables: TemplateVariable[], answers: Record<string, string>): string {
  const byKey = new Map(variables.map((variable) => [variable.key, variable]));
  const filled = content.replace(TOKEN, (full, raw: string) => {
    const key = raw.trim();
    if (!KEY.test(key)) return full;
    const value = answers[key];
    if (!value) return '';
    const variable = byKey.get(key);
    return variable ? formatAnswer(variable, value) : value;
  });
  return plainNoteText(filled);
}
