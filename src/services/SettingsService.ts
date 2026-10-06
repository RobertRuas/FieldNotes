import { db } from '@/database/db';
import { preferenceGet, preferenceSet } from '@/services/platform/preferences';
import { enqueueWrite } from '@/sync/queue';
import type { AppSettings } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';

const SETTINGS_KEY = 'fieldnotes.settingsId';

function blank(id: string, userId: string | null): AppSettings {
  const now = nowIso();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
    userId,
    theme: 'light',
    contentTextSize: 'normal',
  };
}

export const SettingsService = {
  async loadOrCreate(): Promise<AppSettings> {
    const storedId = await preferenceGet(SETTINGS_KEY);
    const id = storedId ?? createId();
    const existing = await db.settings.get(id);
    if (existing && existing.deletedAt === null) return { ...existing, userId: existing.userId ?? null };
    const settings = blank(id, null);
    await enqueueWrite(db.settings, 'settings', settings, 'upsert');
    await preferenceSet(SETTINGS_KEY, id);
    return settings;
  },

  async persist(settings: AppSettings): Promise<void> {
    await enqueueWrite(db.settings, 'settings', { ...settings, syncStatus: 'pending' }, 'upsert');
  },

  async bindUser(userId: string): Promise<AppSettings> {
    const owned = await db.settings.filter((row) => row.userId === userId && row.deletedAt === null).first();
    if (owned) {
      await preferenceSet(SETTINGS_KEY, owned.id);
      return owned;
    }
    const current = await this.loadOrCreate();
    if (!current.userId) {
      const next: AppSettings = { ...current, userId, updatedAt: nowIso(), syncStatus: 'pending' };
      await this.persist(next);
      return next;
    }
    const created = blank(createId(), userId);
    created.theme = current.theme;
    created.contentTextSize = current.contentTextSize;
    await this.persist(created);
    await preferenceSet(SETTINGS_KEY, created.id);
    return created;
  },
};
