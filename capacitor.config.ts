import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.orangecloud.pitchintel',
  appName: 'PitchIntel',
  webDir: 'mobile/www',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: ['wcstat.orangecloud.vn', '*.orangecloud.vn', 'flagcdn.com', 'fonts.googleapis.com', 'fonts.gstatic.com'],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#071014',
  },
  ios: {
    backgroundColor: '#071014',
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#071014',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#071014',
    },
  },
};

export default config;
