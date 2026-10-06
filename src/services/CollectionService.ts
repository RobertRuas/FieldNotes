import { db } from '@/database/db';
import { enqueueWrite } from '@/sync/queue';
import type { Collection } from '@/types/entities';

export const CollectionService = {
  async list(userId: string): Promise<Collection[]> {
    return db.collections.filter((row) => row.userId === userId && row.deletedAt === null).toArray();
  },

  async persist(collection: Collection): Promise<void> {
    const next: Collection = {
      ...collection,
      name: collection.name.trim().slice(0, 80),
      syncStatus: 'pending',
    };
    await enqueueWrite(db.collections, 'collections', next, next.deletedAt ? 'delete' : 'upsert');
  },
};
