import { Capacitor } from '@capacitor/core';

/** Native shell tweaks (status bar, splash hide) — no-op on web. */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/splash-screen'),
    import('@capacitor/status-bar'),
  ]);

  await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  if (Capacitor.getPlatform() === 'android') {
    await StatusBar.setBackgroundColor({ color: '#071014' }).catch(() => undefined);
  }
  await SplashScreen.hide().catch(() => undefined);
}
