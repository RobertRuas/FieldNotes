import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export function pushIntegrationReady(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  return typeof PushNotifications.register === 'function';
}

export async function registerPushToken(): Promise<string | null> {
  if (!pushIntegrationReady()) return null;
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (token: string | null): void => {
      if (settled) return;
      settled = true;
      resolve(token);
    };
    void PushNotifications.addListener('registration', (event) => finish(event.value));
    void PushNotifications.addListener('registrationError', () => finish(null));
    void PushNotifications.register().catch(() => finish(null));
    window.setTimeout(() => finish(null), 8000);
  });
}
