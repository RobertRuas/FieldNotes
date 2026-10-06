import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import { StorageService } from '@/services/StorageService';
import type { Attachment } from '@/types/entities';

export const AttachmentService = {
  async listForNote(noteId: string): Promise<Attachment[]> {
    return db.attachments.filter((row) => row.noteId === noteId && row.deletedAt === null).toArray();
  },

  async persist(attachment: Attachment): Promise<void> {
    await enqueueWrite(db.attachments, 'attachments', { ...attachment, syncStatus: 'pending' }, attachment.deletedAt ? 'delete' : 'upsert');
  },

  async saveWithFile(attachment: Attachment, base64: string): Promise<Attachment> {
    const localUri = await StorageService.writeBase64(`${attachment.id}-${attachment.name}`, base64);
    const next: Attachment = { ...attachment, localUri, syncStatus: 'pending' };
    await this.persist(next);
    return next;
  },
};
