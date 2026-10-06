import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export function pushIntegrationReady(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  return typeof PushNotifications.register === 'function';
}
