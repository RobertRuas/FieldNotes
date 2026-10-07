import type { EntityMeta } from '@/types/entities';
import type { NoteTemplate } from '@/templates/types';
import { readMemory, readVariables } from '@/templates/utils/variables';

function text(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

export function templateFromRow(base: EntityMeta, row: Record<string, unknown>): NoteTemplate | null {
  const userId = text(row, 'userId');
  const name = text(row, 'name');
  const content = text(row, 'content');
  if (!userId || name === null || content === null) return null;
  const lastUsed = row.lastUsedAt;
  const lastUsedAt = lastUsed == null ? null : typeof lastUsed === 'string' ? lastUsed : null;
  if (lastUsed != null && lastUsedAt === null) return null;
  return {
    ...base,
    userId,
    name,
    content,
    variables: readVariables(row.variables),
    favorite: row.favorite === true,
    lastUsedAt,
    lastValues: readMemory(row.lastValues),
    customOrder: row.customOrder === true,
  };
}
