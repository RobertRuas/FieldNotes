import type { NoteTemplate, TemplateVariable } from '@/templates/types';
import { isDateKey, isTimeKey, todayKey } from '@/utils/dates';
import { memoryMap, orderedVariables, YES, NO } from '@/templates/utils/variables';
import { formatDateAnswer } from '@/templates/utils/engine';

function clockKey(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function staticValue(variable: TemplateVariable): string {
  const value = variable.defaultValue.trim();
  if (!value) return '';
  if (variable.type === 'date') return isDateKey(value) ? value : '';
  if (variable.type === 'time') return isTimeKey(value) ? value : '';
  if (variable.type === 'boolean') return value === YES || value === NO ? value : '';
  if (variable.type === 'select') return variable.options.some((option) => option.value === value) ? value : '';
  return value;
}

export function resolveDefault(variable: TemplateVariable, lastValues: Record<string, string>, now = new Date()): string {
  if (variable.defaultKind === 'last') {
    const last = lastValues[variable.key]?.trim() ?? '';
    if (last) return last;
  }
  if (variable.defaultKind === 'today') {
    const today = todayKey(now);
    return variable.type === 'date' ? today : formatDateAnswer(today);
  }
  if (variable.defaultKind === 'now') return clockKey(now);
  if (variable.defaultKind === 'static') return staticValue(variable);
  return '';
}

export function seedAnswers(template: NoteTemplate, now = new Date()): Record<string, string> {
  const last = memoryMap(template.lastValues);
  const answers: Record<string, string> = {};
  for (const variable of orderedVariables(template)) answers[variable.key] = resolveDefault(variable, last, now);
  return answers;
}
