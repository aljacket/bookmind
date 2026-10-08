import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookmind.app',
  appName: 'bookmind',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // Android: inject --safe-area-inset-* CSS variables (read through the --bm-safe-* tokens in src/index.css).
      insetsHandling: 'css',
      // LIGHT = dark status/navigation bar icons, for the app's light-only theme. Android only; iOS is card #55.
      style: 'LIGHT'
    }
  }
};

export default config;
