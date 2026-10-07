import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import type { NoteTemplate } from '@/templates/types';
import { normalizeTemplate } from '@/templates/utils/variables';

export const TemplateService = {
  async list(userId: string): Promise<NoteTemplate[]> {
    return db.templates.filter((row) => row.userId === userId && row.deletedAt === null).toArray();
  },

  async persist(template: NoteTemplate): Promise<void> {
    const next = normalizeTemplate(template);
    await enqueueWrite(db.templates, 'templates', next, next.deletedAt ? 'delete' : 'upsert');
  },
};
