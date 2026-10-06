import Dexie, { type EntityTable } from 'dexie';
import type {
  AppSettings,
  Attachment,
  AudioRecording,
  Collection,
  Device,
  FileTransfer,
  LocalFile,
  Note,
  Notification,
  SyncOperation,
  Task,
  User,
} from '@/types/entities';

export const db = new Dexie('fieldnotes') as Dexie & {
  users: EntityTable<User, 'id'>;
  notes: EntityTable<Note, 'id'>;
  collections: EntityTable<Collection, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  attachments: EntityTable<Attachment, 'id'>;
  audio_recordings: EntityTable<AudioRecording, 'id'>;
  notifications: EntityTable<Notification, 'id'>;
  settings: EntityTable<AppSettings, 'id'>;
  sync_queue: EntityTable<SyncOperation, 'id'>;
  devices: EntityTable<Device, 'id'>;
  local_files: EntityTable<LocalFile, 'id'>;
  file_queue: EntityTable<FileTransfer, 'id'>;
};

db.version(1).stores({
  users: 'id, email, remoteId, syncStatus',
  notes: 'id, userId, date, collectionId, updatedAt, deletedAt, syncStatus',
  collections: 'id, userId, name, updatedAt, deletedAt, syncStatus',
  tasks: 'id, userId, noteId, done, updatedAt, deletedAt, syncStatus',
  attachments: 'id, userId, noteId, kind, updatedAt, deletedAt, syncStatus',
  audio_recordings: 'id, userId, noteId, updatedAt, deletedAt, syncStatus',
  notifications: 'id, userId, noteId, kind, fireAt, updatedAt, deletedAt, syncStatus',
  settings: 'id, updatedAt, syncStatus',
  sync_queue: 'id, entity, entityId, status, nextAttemptAt, [entity+entityId]',
  devices: 'id, userId, platform, updatedAt, syncStatus',
});

// Índices novos da tarefa. Os outros stores continuam da versão 1.
db.version(2).stores({
  tasks: 'id, userId, noteId, collectionId, done, date, updatedAt, deletedAt, syncStatus',
});

// Arquivo original e fila de envio. A lista da nota não carrega o blob.
db.version(3).stores({
  local_files: 'id',
  file_queue: 'id, targetId, status, updatedAt',
});

export async function openDatabase(): Promise<void> {
  await db.open();
}
