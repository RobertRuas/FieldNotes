import type { TemplateDefaultKind, TemplateVariableType } from '@/templates/types';

export const TYPE_LABELS: Record<TemplateVariableType, string> = {
  text: 'Texto',
  long_text: 'Texto longo',
  number: 'Número',
  date: 'Data',
  time: 'Hora',
  select: 'Seleção',
  boolean: 'Sim/Não',
  email: 'E-mail',
  url: 'URL',
};

export const DEFAULT_LABELS: Record<TemplateDefaultKind, string> = {
  none: 'Nenhum',
  static: 'Fixo',
  today: 'Hoje',
  now: 'Agora',
  last: 'Último',
};

export function defaultKindsFor(type: TemplateVariableType): TemplateDefaultKind[] {
  const kinds: TemplateDefaultKind[] = ['none', 'static', 'last'];
  if (type === 'date' || type === 'text' || type === 'long_text') kinds.splice(2, 0, 'today');
  if (type === 'time' || type === 'text') kinds.splice(2, 0, 'now');
  return kinds;
}

export function fieldCountLabel(count: number): string {
  if (count === 0) return 'Sem campos';
  if (count === 1) return '1 campo';
  return `${count} campos`;
}

export function isTextualType(type: TemplateVariableType): boolean {
  return type === 'text' || type === 'long_text' || type === 'number' || type === 'email' || type === 'url';
}
