import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DeviceService } from '@/services/DeviceService';
import type { Device } from '@/types/entities';

export const useDeviceStore = defineStore('deviceStore', () => {
  const device = ref<Device | null>(null);

  async function hydrate(userId: string): Promise<void> {
    device.value = await DeviceService.ensureDevice(userId);
  }

  return { device, hydrate };
});
