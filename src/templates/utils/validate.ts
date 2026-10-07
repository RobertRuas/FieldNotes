import type { NoteTemplate, TemplateVariable } from '@/templates/types';
import { isDateKey, isTimeKey, todayKey } from '@/utils/dates';
import { activeVariables, NO, YES } from '@/templates/utils/variables';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER = /^-?\d+(?:[.,]\d+)?$/;

export function validateAnswer(variable: TemplateVariable, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return variable.required ? 'Este campo é obrigatório.' : null;
  if (variable.type === 'number' && !NUMBER.test(trimmed)) return 'Informe um número.';
  if (variable.type === 'date' && !isDateKey(trimmed)) return 'Escolha uma data.';
  if (variable.type === 'time' && !isTimeKey(trimmed)) return 'Escolha uma hora.';
  if (variable.type === 'email' && !EMAIL.test(trimmed)) return 'Informe um e-mail válido.';
  if (variable.type === 'url') {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'Informe um endereço válido.';
    } catch {
      return 'Informe um endereço válido.';
    }
  }
  if (variable.type === 'boolean' && trimmed !== YES && trimmed !== NO) return 'Escolha Sim ou Não.';
  if (variable.type === 'select') {
    if (variable.options.length === 0) return 'Este campo não tem opções.';
    if (!variable.options.some((option) => option.value === trimmed)) return 'Escolha uma opção.';
  }
  return null;
}

export function noteDateFrom(template: NoteTemplate, answers: Record<string, string>, now = new Date()): string {
  for (const variable of activeVariables(template, answers)) {
    if (variable.type !== 'date') continue;
    const value = answers[variable.key] ?? '';
    if (isDateKey(value)) return value;
  }
  return todayKey(now);
}
