import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.petermonroe.readingtracker.companion',
  appName: 'Reading Tracker',
  webDir: 'dist-companion',
  plugins: { SystemBars: { style: 'LIGHT' }, CapacitorSQLite: { androidIsEncryption: false } },
};
export default config;
