import type {
  AppSettings,
  Attachment,
  AttachmentKind,
  AudioRecording,
  Collection,
  ContentTextSize,
  Device,
  DevicePlatform,
  EntityMeta,
  Note,
  Notification,
  NotificationKind,
  SyncEntityName,
  SyncStatus,
  Task,
  ThemeMode,
  User,
} from '@/types/entities';
import { isDateKey, isTimeKey } from '@/utils/dates';
import { isRecord } from '@/utils/guards';
import { isPriority, normalizeTask } from '@/utils/tasks';

export type ParsedEntity =
  | { entity: 'users'; record: User }
  | { entity: 'notes'; record: Note }
  | { entity: 'collections'; record: Collection }
  | { entity: 'tasks'; record: Task }
  | { entity: 'attachments'; record: Attachment }
  | { entity: 'audio_recordings'; record: AudioRecording }
  | { entity: 'notifications'; record: Notification }
  | { entity: 'settings'; record: AppSettings }
  | { entity: 'devices'; record: Device };

const STATUSES: readonly SyncStatus[] = ['pending', 'synced', 'error', 'conflict'];

function isStatus(value: unknown): value is SyncStatus {
  return typeof value === 'string' && STATUSES.some((status) => status === value);
}

export function keysToCamel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => keysToCamel(item));
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const camel = key.replace(/_([a-z0-9])/g, (_full, char: string) => char.toUpperCase());
    out[camel] = keysToCamel(item);
  }
  return out;
}

export function keysToSnake(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => keysToSnake(item));
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const snake = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
    out[snake] = keysToSnake(item);
  }
  return out;
}

function text(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function optionalText(row: Record<string, unknown>, key: string, fallback: string | null): string | null | undefined {
  if (!(key in row)) return fallback;
  const value = row[key];
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
}

function metaOf(row: Record<string, unknown>): EntityMeta | null {
  const id = text(row, 'id');
  const createdAt = text(row, 'createdAt');
  const updatedAt = text(row, 'updatedAt');
  const deletedAt = optionalText(row, 'deletedAt', null);
  if (!id || !createdAt || !updatedAt || deletedAt === undefined) return null;
  const raw = row.syncStatus;
  const syncStatus = raw === undefined ? 'synced' : isStatus(raw) ? raw : null;
  if (!syncStatus) return null;
  return { id, createdAt, updatedAt, deletedAt, syncStatus };
}

function stringList(row: Record<string, unknown>, key: string): string[] | null {
  if (!(key in row) || row[key] === undefined) return [];
  const value = row[key];
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    items.push(item);
  }
  return items;
}

function flag(row: Record<string, unknown>, key: string): boolean | null {
  return typeof row[key] === 'boolean' ? row[key] : null;
}

function amount(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalDate(row: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in row) || row[key] == null) return null;
  const value = row[key];
  return typeof value === 'string' && isDateKey(value) ? value : undefined;
}

function optionalClock(row: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in row) || row[key] == null) return null;
  const value = row[key];
  return typeof value === 'string' && isTimeKey(value) ? value : undefined;
}

function optionalPriority(row: Record<string, unknown>): Task['priority'] | undefined {
  if (!('priority' in row) || row.priority == null) return null;
  return isPriority(row.priority) ? row.priority : undefined;
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
  if (typeof value !== 'string') return null;
  return options.find((option) => option === value) ?? null;
}

export function parseEntity(entity: SyncEntityName, value: unknown): ParsedEntity | null {
  const camel = keysToCamel(value);
  if (!isRecord(camel)) return null;
  const base = metaOf(camel);
  if (!base) return null;
  switch (entity) {
    case 'users': {
      const email = optionalText(camel, 'email', null);
      const displayName = optionalText(camel, 'displayName', null);
      const remoteId = optionalText(camel, 'remoteId', null);
      if (email === undefined || displayName === undefined || remoteId === undefined) return null;
      return { entity, record: { ...base, email, displayName, remoteId } };
    }
    case 'notes': {
      const userId = text(camel, 'userId');
      const title = text(camel, 'title');
      const body = text(camel, 'text');
      const date = text(camel, 'date');
      const attachments = stringList(camel, 'attachments');
      const photos = stringList(camel, 'photos');
      const documents = stringList(camel, 'documents');
      const audio = stringList(camel, 'audio');
      const tasks = stringList(camel, 'tasks');
      const collectionId = optionalText(camel, 'collectionId', null);
      const reminderAt = optionalText(camel, 'reminderAt', null);
      if (!userId || title === null || body === null || !date) return null;
      if (!attachments || !photos || !documents || !audio || !tasks) return null;
      if (collectionId === undefined || reminderAt === undefined) return null;
      return {
        entity,
        record: {
          ...base,
          userId,
          title,
          text: body,
          date,
          attachments,
          photos,
          documents,
          audio,
          tasks,
          collectionId,
          reminderAt,
          pinned: camel.pinned === true,
          favorite: camel.favorite === true,
        },
      };
    }
    case 'collections': {
      const userId = text(camel, 'userId');
      const name = text(camel, 'name');
      const color = text(camel, 'color');
      if (!userId || name === null || !color) return null;
      return { entity, record: { ...base, userId, name, color } };
    }
    case 'tasks': {
      const userId = text(camel, 'userId');
      const title = text(camel, 'title');
      const detail = text(camel, 'detail') ?? '';
      const done = flag(camel, 'done');
      const noteId = optionalText(camel, 'noteId', null);
      const collectionId = optionalText(camel, 'collectionId', null);
      const dueAt = optionalText(camel, 'dueAt', null);
      const date = optionalDate(camel, 'date');
      const time = optionalClock(camel, 'time');
      const reminderAt = optionalText(camel, 'reminderAt', null);
      const priority = optionalPriority(camel);
      if (!userId || title === null || done === null) return null;
      if (noteId === undefined || collectionId === undefined || dueAt === undefined || reminderAt === undefined) return null;
      if (date === undefined || time === undefined || priority === undefined) return null;
      return {
        entity,
        record: normalizeTask({
          ...base,
          userId,
          noteId,
          collectionId,
          title,
          detail,
          done,
          date,
          time,
          priority,
          reminderAt,
          dueAt,
        }),
      };
    }
    case 'attachments': {
      const userId = text(camel, 'userId');
      const noteId = text(camel, 'noteId');
      const kind = oneOf<AttachmentKind>(camel.kind, ['photo', 'document', 'file']);
      const name = text(camel, 'name');
      const mimeType = text(camel, 'mimeType');
      const size = amount(camel, 'size');
      const localUri = optionalText(camel, 'localUri', null);
      const remotePath = optionalText(camel, 'remotePath', null);
      const thumbnail = optionalText(camel, 'thumbnail', null);
      if (!userId || !noteId || !kind || name === null || !mimeType || size === null) return null;
      if (localUri === undefined || remotePath === undefined || thumbnail === undefined) return null;
      return { entity, record: { ...base, userId, noteId, kind, name, mimeType, size, localUri, remotePath, thumbnail } };
    }
    case 'audio_recordings': {
      const userId = text(camel, 'userId');
      const noteId = text(camel, 'noteId');
      const durationMs = amount(camel, 'durationMs');
      const mimeType = text(camel, 'mimeType');
      const localUri = optionalText(camel, 'localUri', null);
      const remotePath = optionalText(camel, 'remotePath', null);
      if (!userId || !noteId || durationMs === null || !mimeType) return null;
      if (localUri === undefined || remotePath === undefined) return null;
      return { entity, record: { ...base, userId, noteId, durationMs, mimeType, localUri, remotePath } };
    }
    case 'notifications': {
      const userId = text(camel, 'userId');
      const kind = oneOf<NotificationKind>(camel.kind, ['reminder', 'sync', 'system']);
      const title = text(camel, 'title');
      const body = text(camel, 'body');
      const readAt = optionalText(camel, 'readAt', null);
      const noteId = optionalText(camel, 'noteId', null);
      const fireAt = optionalText(camel, 'fireAt', null);
      if (!userId || !kind || title === null || body === null) return null;
      if (readAt === undefined || noteId === undefined || fireAt === undefined) return null;
      return { entity, record: { ...base, userId, kind, title, body, readAt, noteId, fireAt } };
    }
    case 'settings': {
      const theme = oneOf<ThemeMode>(camel.theme, ['light', 'dark', 'auto']);
      const contentTextSize = oneOf<ContentTextSize>(camel.contentTextSize, [
        'minimo',
        'pequeno',
        'normal',
        'grande',
        'muito-grande',
      ]);
      const userId = optionalText(camel, 'userId', null);
      if (!theme || !contentTextSize || userId === undefined) return null;
      return { entity, record: { ...base, userId, theme, contentTextSize } };
    }
    case 'devices': {
      const userId = text(camel, 'userId');
      const name = text(camel, 'name');
      const platform = oneOf<DevicePlatform>(camel.platform, ['web', 'ios', 'android']);
      const pushToken = optionalText(camel, 'pushToken', null);
      if (!userId || name === null || !platform || pushToken === undefined) return null;
      return { entity, record: { ...base, userId, name, platform, pushToken } };
    }
    default: {
      const neverEntity: never = entity;
      return neverEntity;
    }
  }
}
