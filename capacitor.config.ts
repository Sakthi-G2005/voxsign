import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.voxsign',
  appName: 'VoxSign',
  webDir: 'public',
  server: {
    // VoxSign runs a live server (database, realtime chat, ESP32 endpoint),
    // so the native shell loads the published app instead of static files.
    url: 'https://voxsign.lovable.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#0f172a',
      style: 'DARK',
    },
  },
};

export default config;
