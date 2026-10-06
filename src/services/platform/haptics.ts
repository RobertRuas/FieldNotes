import { Capacitor } from '@capacitor/core';

export async function hapticLight(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light });
}
