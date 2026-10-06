import { Capacitor } from '@capacitor/core';
import { db } from '@/database/db';
import { DeviceService } from '@/services/DeviceService';
import { AuthService } from '@/services/AuthService';
import { registerPushToken } from '@/services/platform/push';
import { displayTitle } from '@/utils/text';

export type AlertPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

const timers = new Map<string, number>();
const MAX_TIMEOUT = 2_147_000_000;

interface TimestampTriggerConstructor {
  new (timestamp: number): unknown;
}

function triggerCtor(): TimestampTriggerConstructor | null {
  const host = globalThis as { TimestampTrigger?: TimestampTriggerConstructor };
  return typeof host.TimestampTrigger === 'function' ? host.TimestampTrigger : null;
}

export function notificationPermission(): AlertPermission {
  if (Capacitor.isNativePlatform()) return 'prompt';
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

async function nativePermission(ask: boolean): Promise<AlertPermission> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return 'granted';
  if (!ask || current.display === 'denied') return current.display === 'denied' ? 'denied' : 'prompt';
  const next = await LocalNotifications.requestPermissions();
  if (next.display === 'granted') return 'granted';
  return next.display === 'denied' ? 'denied' : 'prompt';
}

async function webPermission(ask: boolean): Promise<AlertPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  if (!ask) return 'prompt';
  const result = await Notification.requestPermission();
  if (result === 'granted') return 'granted';
  if (result === 'denied') return 'denied';
  return 'prompt';
}

export async function ensureAlertPermission(ask: boolean): Promise<AlertPermission> {
  const permission = Capacitor.isNativePlatform() ? await nativePermission(ask) : await webPermission(ask);
  if (permission === 'granted' && Capacitor.isNativePlatform()) {
    const token = await registerPushToken();
    const user = AuthService.current();
    if (token && user) await DeviceService.rememberPushToken(user.id, token);
  }
  return permission;
}

function numericId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  const value = Math.abs(hash % 2_147_000_000);
  return value === 0 ? 1 : value;
}

async function showWeb(id: string, title: string, body: string, at: number): Promise<boolean> {
  const Ctor = triggerCtor();
  if (!Ctor || !('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      tag: id,
      showTrigger: new Ctor(at),
    } as NotificationOptions);
    return true;
  } catch {
    return false;
  }
}

function armTimer(id: string, title: string, body: string, fireAt: string): void {
  const previous = timers.get(id);
  if (previous) window.clearTimeout(previous);
  const at = Date.parse(fireAt);
  if (Number.isNaN(at)) return;
  const delay = at - Date.now();
  const show = (): void => {
    timers.delete(id);
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(title, { body, tag: id });
  };
  if (delay <= 0) {
    if (delay > -120_000) show();
    return;
  }
  const wait = Math.min(delay, MAX_TIMEOUT);
  const handle = window.setTimeout(() => {
    if (wait < delay) armTimer(id, title, body, fireAt);
    else show();
  }, wait);
  timers.set(id, handle);
}

async function scheduleNative(id: string, title: string, body: string, at: number): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.schedule({
    notifications: [
      {
        id: numericId(id),
        title,
        body,
        schedule: { at: new Date(at) },
        extra: { key: id },
      },
    ],
  });
}

async function cancelNative(id: string): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: numericId(id) }] });
}

async function cancelWeb(id: string): Promise<void> {
  const handle = timers.get(id);
  if (handle) window.clearTimeout(handle);
  timers.delete(id);
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const notes = await registration.getNotifications({ tag: id });
    notes.forEach((note) => note.close());
  } catch {
    // Sem service worker o timer já foi cancelado.
  }
}

export async function cancelReminder(id: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await cancelNative(id);
    } catch {
      // O horário local continua cancelado mesmo sem o plugin.
    }
    return;
  }
  await cancelWeb(id);
}

export async function scheduleReminder(input: {
  id: string;
  title: string;
  body: string;
  fireAt: string | null;
  ask: boolean;
}): Promise<'scheduled' | 'saved'> {
  await cancelReminder(input.id);
  if (!input.fireAt) return 'saved';
  const at = Date.parse(input.fireAt);
  if (Number.isNaN(at) || at <= Date.now()) return 'saved';
  const permission = await ensureAlertPermission(input.ask);
  if (permission !== 'granted') return 'saved';
  if (Capacitor.isNativePlatform()) {
    await scheduleNative(input.id, input.title, input.body, at);
    return 'scheduled';
  }
  const triggered = await showWeb(input.id, input.title, input.body, at);
  if (!triggered) armTimer(input.id, input.title, input.body, input.fireAt);
  return 'scheduled';
}

export async function resumeReminders(): Promise<void> {
  const user = AuthService.current();
  if (!user) return;
  const permission = await ensureAlertPermission(false);
  if (permission !== 'granted') return;
  const notes = await db.notes
    .filter((row) => row.userId === user.id && row.deletedAt === null && row.reminderAt !== null)
    .toArray();
  for (const note of notes) {
    await scheduleReminder({
      id: `note:${note.id}`,
      title: displayTitle(note),
      body: 'Lembrete da nota',
      fireAt: note.reminderAt,
      ask: false,
    });
  }
  const tasks = await db.tasks
    .filter((row) => row.userId === user.id && row.deletedAt === null && !row.done && row.reminderAt !== null)
    .toArray();
  for (const task of tasks) {
    await scheduleReminder({
      id: `task:${task.id}`,
      title: task.title,
      body: 'Lembrete da tarefa',
      fireAt: task.reminderAt,
      ask: false,
    });
  }
}
