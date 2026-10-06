import { Capacitor } from '@capacitor/core';
import { db } from '@/database/db';
import { preferenceGet, preferenceSet } from '@/services/platform/preferences';
import { enqueueWrite } from '@/sync/queue';
import type { Device, DevicePlatform } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';

const DEVICE_KEY = 'fieldnotes.deviceId';

function currentPlatform(): DevicePlatform {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') return platform;
  return 'web';
}

function deviceName(platform: DevicePlatform): string {
  if (platform === 'ios') return 'iPhone';
  if (platform === 'android') return 'Android';
  return 'Navegador';
}

export const DeviceService = {
  async ensureDevice(userId: string): Promise<Device> {
    const existingId = await preferenceGet(DEVICE_KEY);
    if (existingId) {
      const row = await db.devices.get(existingId);
      if (row && row.deletedAt === null) return row;
    }
    const now = nowIso();
    const platform = currentPlatform();
    const device: Device = {
      id: createId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      userId,
      name: deviceName(platform),
      platform,
      pushToken: null,
    };
    await enqueueWrite(db.devices, 'devices', device, 'upsert');
    await preferenceSet(DEVICE_KEY, device.id);
    return device;
  },
};
