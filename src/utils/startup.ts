import { AttachmentService } from '@/services/AttachmentService';
import { AudioService } from '@/services/AudioService';
import { NotificationService } from '@/services/NotificationService';
import { prepareNativeShell } from '@/services/platform/nativeShell';
import { SyncService } from '@/services/SyncService';
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
  SyncService.onApplied(() => {
    void useNotesStore().hydrate();
    void useTasksStore().hydrate();
    void useCollectionsStore().hydrate();
    void useNotificationStore().hydrate();
    void useSettingsStore().hydrate();
  });
  await useSettingsStore().hydrate();
  await useAuthStore().hydrate();
  const userId = useAuthStore().userId;
  if (userId) await useDeviceStore().hydrate(userId);
  await Promise.all([
    useNotesStore().hydrate(),
    useTasksStore().hydrate(),
    useCollectionsStore().hydrate(),
    useNotificationStore().hydrate(),
  ]);
  SyncService.start();
  NotificationService.preparePush();
  await prepareNativeShell(resolveDark(useSettingsStore().theme));
  // Anexos e áudio já têm persistência local; a captura fica para a fase seguinte.
  void AttachmentService;
  void AudioService;
}
