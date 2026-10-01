import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.willay.app',
  appName: 'Willay',
  webDir: 'dist/mobile/browser',
  server: {
    // Desarrollo: el backend local usa http. Con el backend desplegado (https) esto se puede quitar.
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
