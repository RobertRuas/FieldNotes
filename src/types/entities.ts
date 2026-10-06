export type SyncStatus = 'pending' | 'synced' | 'error' | 'conflict';

export type ThemeMode = 'light' | 'dark' | 'auto';

export type ContentTextSize = 'pequeno' | 'normal' | 'grande' | 'muito-grande';

export type DevicePlatform = 'web' | 'ios' | 'android';

export type AttachmentKind = 'photo' | 'document' | 'file';

export type NotificationKind = 'reminder' | 'sync' | 'system';

export type SyncEntityName =
  | 'users'
  | 'notes'
  | 'collections'
  | 'tasks'
  | 'attachments'
  | 'audio_recordings'
  | 'notifications'
  | 'settings'
  | 'devices';

export type SyncOperationKind = 'upsert' | 'delete';

export type SyncQueueStatus = 'pending' | 'processing' | 'failed';

export interface EntityMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

export interface User extends EntityMeta {
  email: string | null;
  displayName: string | null;
  remoteId: string | null;
}

export interface Note extends EntityMeta {
  userId: string;
  title: string;
  text: string;
  attachments: string[];
  photos: string[];
  documents: string[];
  audio: string[];
  tasks: string[];
  date: string;
  collectionId: string | null;
  reminderAt: string | null;
}

export type TaskPriority = 'baixa' | 'normal' | 'alta';

export interface Task extends EntityMeta {
  userId: string;
  noteId: string | null;
  collectionId: string | null;
  title: string;
  detail: string;
  /** `done` é a conclusão. O lembrete também agenda o aviso neste aparelho. */
  done: boolean;
  date: string | null;
  time: string | null;
  priority: TaskPriority | null;
  reminderAt: string | null;
  dueAt: string | null;
}

export interface Collection extends EntityMeta {
  userId: string;
  name: string;
  color: string;
}

export interface Attachment extends EntityMeta {
  userId: string;
  noteId: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  localUri: string | null;
  remotePath: string | null;
  /** Miniatura para a lista. O arquivo original não entra neste campo. */
  thumbnail: string | null;
}

export interface AudioRecording extends EntityMeta {
  userId: string;
  noteId: string;
  durationMs: number;
  mimeType: string;
  localUri: string | null;
  remotePath: string | null;
}

export interface Notification extends EntityMeta {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  readAt: string | null;
  noteId: string | null;
  fireAt: string | null;
}

export interface AppSettings extends EntityMeta {
  userId: string | null;
  theme: ThemeMode;
  contentTextSize: ContentTextSize;
}

export interface Device extends EntityMeta {
  userId: string;
  name: string;
  platform: DevicePlatform;
  pushToken: string | null;
}

/** Estado do envio do arquivo. Não é o syncStatus do registro. */
export type TransferStatus = 'aguardando' | 'sincronizando' | 'sincronizado' | 'erro';

export interface FileTransfer {
  id: string;
  target: 'attachment' | 'audio';
  targetId: string;
  status: TransferStatus;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
}

export interface LocalFile {
  id: string;
  mimeType: string;
  blob: Blob;
}

export interface SyncOperation extends EntityMeta {
  entity: SyncEntityName;
  entityId: string;
  operation: SyncOperationKind;
  payload: string;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  status: SyncQueueStatus;
}
