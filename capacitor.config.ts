import type { CapacitorConfig } from '@capacitor/cli';

// O app nativo, quando for gerado, usa o mesmo build da PWA.
// Não existe um segundo aplicativo iOS.
const config: CapacitorConfig = {
  appId: 'app.fieldnotes.pwa',
  appName: 'FieldNotes',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#efece6',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#efece6',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
