import type {
  NoteTemplate,
  TemplateDefaultKind,
  TemplateMemory,
  TemplateOption,
  TemplateVariable,
  TemplateVariableType,
  TemplateWhen,
} from '@/templates/types';
import { TEMPLATE_DEFAULT_KINDS, TEMPLATE_VARIABLE_TYPES } from '@/templates/types';
import { createId } from '@/utils/id';
import { isRecord } from '@/utils/guards';
import { extractVariables } from '@/templates/utils/parser';

export const YES = 'Sim';
export const NO = 'Não';

const TYPE_SET = new Set<string>(TEMPLATE_VARIABLE_TYPES);
const KIND_SET = new Set<string>(TEMPLATE_DEFAULT_KINDS);

export function humanizeKey(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  if (!words) return key;
  return words.charAt(0).toLocaleUpperCase('pt-BR') + words.slice(1);
}

export function questionFor(variable: Pick<TemplateVariable, 'prompt' | 'label' | 'key'>): string {
  const prompt = variable.prompt.trim();
  if (prompt) return prompt;
  const label = variable.label.trim() || humanizeKey(variable.key);
  return label.endsWith('?') ? label : `${label}?`;
}

export function blankVariable(key: string, order: number): TemplateVariable {
  const label = humanizeKey(key);
  return {
    id: createId(),
    key,
    label,
    prompt: `${label}?`,
    type: 'text',
    required: true,
    placeholder: '',
    defaultKind: 'none',
    defaultValue: '',
    options: [],
    when: null,
    order,
  };
}

export function reconcileVariables(content: string, current: TemplateVariable[]): TemplateVariable[] {
  const keys = extractVariables(content);
  const byKey = new Map(current.map((item) => [item.key, item]));
  return keys.map((key, index) => byKey.get(key) ?? blankVariable(key, index));
}

export function orderedVariables(template: Pick<NoteTemplate, 'content' | 'variables' | 'customOrder'>): TemplateVariable[] {
  const keys = extractVariables(template.content);
  const byKey = new Map(template.variables.map((item) => [item.key, item]));
  const listed: TemplateVariable[] = [];
  keys.forEach((key, index) => {
    const known = byKey.get(key);
    listed.push(known ? { ...known, order: known.order } : blankVariable(key, index));
  });
  if (!template.customOrder) return listed;
  return [...listed].sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
}

export function stepVisible(variable: TemplateVariable, answers: Record<string, string>): boolean {
  if (!variable.when) return true;
  return answers[variable.when.variableKey] === variable.when.equals;
}

export function activeVariables(
  template: Pick<NoteTemplate, 'content' | 'variables' | 'customOrder'>,
  answers: Record<string, string>,
): TemplateVariable[] {
  return orderedVariables(template).filter((variable) => stepVisible(variable, answers));
}

export function memoryMap(rows: TemplateMemory[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export function memoryRows(values: Record<string, string>): TemplateMemory[] {
  const rows: TemplateMemory[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!key || !value) continue;
    rows.push({ key, value });
  }
  return rows;
}

function oneOfType(value: unknown): TemplateVariableType | null {
  return typeof value === 'string' && TYPE_SET.has(value) ? (value as TemplateVariableType) : null;
}

function oneOfKind(value: unknown): TemplateDefaultKind | null {
  return typeof value === 'string' && KIND_SET.has(value) ? (value as TemplateDefaultKind) : null;
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function readOptions(value: unknown): TemplateOption[] {
  if (!Array.isArray(value)) return [];
  const options: TemplateOption[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const label = typeof item.label === 'string' ? clip(item.label, 80) : '';
    if (!label) continue;
    const stored = typeof item.value === 'string' ? clip(item.value, 80) : '';
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 80) : `op-${options.length}`;
    options.push({ id, label, value: stored || label });
    if (options.length >= 30) break;
  }
  return options;
}

function readWhen(value: unknown): TemplateWhen | null {
  if (!isRecord(value)) return null;
  const variableKey = typeof value.variableKey === 'string' ? clip(value.variableKey, 40) : '';
  const equals = typeof value.equals === 'string' ? value.equals.trim().slice(0, 200) : '';
  if (!variableKey || !equals) return null;
  return { variableKey, equals };
}

export function readVariable(value: unknown, index: number): TemplateVariable | null {
  if (!isRecord(value)) return null;
  const key = typeof value.key === 'string' ? value.key.trim() : '';
  if (!/^[\p{L}_][\p{L}\p{N}_]{0,39}$/u.test(key)) return null;
  const type = oneOfType(value.type) ?? 'text';
  const kind = oneOfKind(value.defaultKind) ?? 'none';
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim().slice(0, 80) : `var-${key}`;
  const label = typeof value.label === 'string' ? clip(value.label, 80) : '';
  const prompt = typeof value.prompt === 'string' ? clip(value.prompt, 160) : '';
  const options = type === 'select' ? readOptions(value.options) : [];
  return {
    id,
    key,
    label: label || humanizeKey(key),
    prompt,
    type,
    required: value.required !== false,
    placeholder: typeof value.placeholder === 'string' ? clip(value.placeholder, 120) : '',
    defaultKind: kind,
    defaultValue: typeof value.defaultValue === 'string' ? value.defaultValue.trim().slice(0, 500) : '',
    options,
    when: readWhen(value.when),
    order: typeof value.order === 'number' && Number.isFinite(value.order) ? value.order : index,
  };
}

export function readVariables(value: unknown): TemplateVariable[] {
  if (!Array.isArray(value)) return [];
  const items: TemplateVariable[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const variable = readVariable(item, items.length);
    if (!variable || seen.has(variable.key)) continue;
    seen.add(variable.key);
    items.push(variable);
    if (items.length >= 50) break;
  }
  return items;
}

export function readMemory(value: unknown): TemplateMemory[] {
  if (!Array.isArray(value)) return [];
  const rows: TemplateMemory[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== 'string' || typeof item.value !== 'string') continue;
    const key = item.key.trim().slice(0, 40);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, value: item.value.slice(0, 2_000) });
    if (rows.length >= 50) break;
  }
  return rows;
}

export function normalizeTemplate(template: NoteTemplate): NoteTemplate {
  const content = template.content.replaceAll('\r\n', '\n').slice(0, 100_000);
  const variables = reconcileVariables(content, readVariables(template.variables)).map((item, index) => ({
    ...item,
    order: template.customOrder ? item.order : index,
  }));
  const allowed = new Set(variables.map((item) => item.key));
  const lastValues = readMemory(template.lastValues).filter((item) => allowed.has(item.key));
  return {
    ...template,
    name: template.name.trim().slice(0, 80),
    content,
    variables: JSON.parse(JSON.stringify(variables)) as TemplateVariable[],
    lastValues: JSON.parse(JSON.stringify(lastValues)) as TemplateMemory[],
    favorite: template.favorite === true,
    customOrder: template.customOrder === true,
    lastUsedAt: template.lastUsedAt,
    syncStatus: 'pending',
  };
}
