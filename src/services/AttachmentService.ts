import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import type { Attachment } from '@/types/entities';

export const AttachmentService = {
  async list(userId: string): Promise<Attachment[]> {
    const rows = await db.attachments.filter((row) => row.userId === userId && row.deletedAt === null).toArray();
    return rows.map((row) => ({ ...row, thumbnail: row.thumbnail ?? null }));
  },

  async listForNote(noteId: string): Promise<Attachment[]> {
    return db.attachments.filter((row) => row.noteId === noteId && row.deletedAt === null).toArray();
  },

  async persist(attachment: Attachment): Promise<void> {
    const next: Attachment = {
      ...attachment,
      name: attachment.name.trim().slice(0, 180),
      thumbnail: attachment.thumbnail,
      syncStatus: attachment.syncStatus === 'synced' ? 'synced' : 'pending',
    };
    await enqueueWrite(db.attachments, 'attachments', next, next.deletedAt ? 'delete' : 'upsert');
  },
};
