import { db } from '@/database/db';
import { preferenceGet, preferenceSet } from '@/services/platform/preferences';
import { enqueueWrite } from '@/sync/queue';
import type { AppSettings } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';

const SETTINGS_KEY = 'fieldnotes.settingsId';

function blank(id: string): AppSettings {
  const now = nowIso();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
    theme: 'light',
    contentTextSize: 'normal',
  };
}

export const SettingsService = {
  async loadOrCreate(): Promise<AppSettings> {
    const storedId = await preferenceGet(SETTINGS_KEY);
    const id = storedId ?? createId();
    const existing = await db.settings.get(id);
    if (existing && existing.deletedAt === null) return existing;
    const settings = blank(id);
    await enqueueWrite(db.settings, 'settings', settings, 'upsert');
    await preferenceSet(SETTINGS_KEY, id);
    return settings;
  },

  async persist(settings: AppSettings): Promise<void> {
    await enqueueWrite(db.settings, 'settings', { ...settings, syncStatus: 'pending' }, 'upsert');
  },
};
