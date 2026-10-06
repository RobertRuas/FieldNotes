import { Capacitor } from '@capacitor/core';

export async function prepareNativeShell(dark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await SplashScreen.hide();
}
