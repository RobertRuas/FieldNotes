import { SettingsService } from '@/services/SettingsService';
import { resumeReminders } from '@/notifications/scheduler';
import { useAttachmentsStore } from '@/stores/attachmentsStore';
import { useAudioStore } from '@/stores/audioStore';
import { useAuthStore } from '@/stores/authStore';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { useNotesStore } from '@/stores/notesStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTasksStore } from '@/stores/tasksStore';

export async function reloadWorkspace(): Promise<void> {
  const auth = useAuthStore();
  const userId = auth.userId;
  if (userId && auth.signedIn) {
    await SettingsService.bindUser(userId);
    await useSettingsStore().hydrate();
  }
  if (userId) await useDeviceStore().hydrate(userId);
  await Promise.all([
    useNotesStore().hydrate(),
    useTasksStore().hydrate(),
    useCollectionsStore().hydrate(),
    useNotificationStore().hydrate(),
    useAttachmentsStore().hydrate(),
    useAudioStore().hydrate(),
  ]);
  await resumeReminders();
}
