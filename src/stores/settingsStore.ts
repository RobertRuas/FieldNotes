import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { SettingsService } from '@/services/SettingsService';
import type { AppSettings, ContentTextSize, ThemeMode } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { pushToast } from '@/composables/useToast';
import { applyThemeToDocument } from '@/utils/theme';

export const useSettingsStore = defineStore('settingsStore', () => {
  const settings = ref<AppSettings | null>(null);
  const theme = computed(() => settings.value?.theme ?? 'light');
  const contentTextSize = computed(() => settings.value?.contentTextSize ?? 'normal');

  async function hydrate(): Promise<void> {
    settings.value = await SettingsService.loadOrCreate();
    applyThemeToDocument(settings.value.theme, settings.value.contentTextSize);
  }

  async function update(patch: Pick<AppSettings, 'theme' | 'contentTextSize'>): Promise<void> {
    if (!settings.value) return;
    const previous = settings.value;
    const next: AppSettings = {
      ...previous,
      ...patch,
      updatedAt: nowIso(),
      syncStatus: 'pending',
    };
    settings.value = next;
    applyThemeToDocument(next.theme, next.contentTextSize);
    try {
      await SettingsService.persist(next);
    } catch {
      settings.value = previous;
      applyThemeToDocument(previous.theme, previous.contentTextSize);
      pushToast('Não foi possível salvar a configuração neste aparelho.');
    }
  }

  function setTheme(next: ThemeMode): Promise<void> {
    return update({ theme: next, contentTextSize: contentTextSize.value });
  }

  function setTextSize(next: ContentTextSize): Promise<void> {
    return update({ theme: theme.value, contentTextSize: next });
  }

  return { settings, theme, contentTextSize, hydrate, setTheme, setTextSize };
});
