import { db } from '@/database/db';
import { preferenceGet, preferenceSet } from '@/services/platform/preferences';
import { enqueueWrite } from '@/sync/queue';
import type { User } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';

const USER_KEY = 'fieldnotes.userId';

let current: User | null = null;

export const AuthService = {
  current(): User | null {
    return current;
  },

  async ensureLocalUser(): Promise<User> {
    const existingId = await preferenceGet(USER_KEY);
    if (existingId) {
      const row = await db.users.get(existingId);
      if (row && row.deletedAt === null) {
        current = row;
        return row;
      }
    }
    const now = nowIso();
    const user: User = {
      id: createId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      email: null,
      displayName: 'Neste aparelho',
      remoteId: null,
    };
    await enqueueWrite(db.users, 'users', user, 'upsert');
    await preferenceSet(USER_KEY, user.id);
    current = user;
    return user;
  },

  // A tela de entrada fica para a fase de autenticação.
  signIn(): { ok: false; reason: 'pendente' } {
    return { ok: false, reason: 'pendente' };
  },
};
