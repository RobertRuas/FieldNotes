import type { EntityMeta } from '@/types/entities';

export const TEMPLATE_VARIABLE_TYPES = [
  'text',
  'long_text',
  'number',
  'date',
  'time',
  'select',
  'boolean',
  'email',
  'url',
] as const;

export type TemplateVariableType = (typeof TEMPLATE_VARIABLE_TYPES)[number];

export const TEMPLATE_DEFAULT_KINDS = ['none', 'static', 'today', 'now', 'last'] as const;

export type TemplateDefaultKind = (typeof TEMPLATE_DEFAULT_KINDS)[number];

export interface TemplateOption {
  id: string;
  label: string;
  value: string;
}

/** O wizard só mostra o campo quando a outra resposta for igual a `equals`. */
export interface TemplateWhen {
  variableKey: string;
  equals: string;
}

export interface TemplateVariable {
  id: string;
  key: string;
  label: string;
  prompt: string;
  type: TemplateVariableType;
  required: boolean;
  placeholder: string;
  defaultKind: TemplateDefaultKind;
  defaultValue: string;
  options: TemplateOption[];
  when: TemplateWhen | null;
  /** Usada só quando o modelo tem ordem manual. */
  order: number;
}

/** Par chave/valor. A chave da variável fica no valor, para o sync não a reescrever. */
export interface TemplateMemory {
  key: string;
  value: string;
}

export interface NoteTemplate extends EntityMeta {
  userId: string;
  name: string;
  content: string;
  variables: TemplateVariable[];
  favorite: boolean;
  lastUsedAt: string | null;
  lastValues: TemplateMemory[];
  customOrder: boolean;
}
