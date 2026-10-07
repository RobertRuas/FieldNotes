import { resumeReminders } from '@/notifications/scheduler';
import { SettingsService } from '@/services/SettingsService';
import { prepareNativeShell } from '@/services/platform/nativeShell';
import { SyncService } from '@/services/SyncService';
import { pumpTransfers } from '@/sync/fileQueue';
import { useAttachmentsStore } from '@/stores/attachmentsStore';
import { useAudioStore } from '@/stores/audioStore';
import { useAuthStore } from '@/stores/authStore';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { useNotesStore } from '@/stores/notesStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useTasksStore } from '@/stores/tasksStore';
import { openDatabase } from '@/database/db';
import { resolveDark } from '@/utils/theme';

export async function startup(): Promise<void> {
  await openDatabase();
  useSyncStore().listen();
  SyncService.onMarked((mark) => {
    if (mark.entity === 'notes') useNotesStore().adoptSynced(mark.id, mark.updatedAt);
  });
  SyncService.onApplied(() => {
    void useNotesStore().hydrate();
    void useTasksStore().hydrate();
    void useCollectionsStore().hydrate();
    void useNotificationStore().hydrate();
    void useSettingsStore().hydrate();
    void useAttachmentsStore().hydrate();
    void useAudioStore().hydrate();
  });
  await useSettingsStore().hydrate();
  await useAuthStore().hydrate();
  const userId = useAuthStore().userId;
  if (userId && useAuthStore().signedIn) {
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
  SyncService.start();
  await prepareNativeShell(resolveDark(useSettingsStore().theme));
  void resumeReminders();
  void pumpTransfers();
}
