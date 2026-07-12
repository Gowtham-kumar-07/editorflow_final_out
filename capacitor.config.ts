import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.editorflow.app',
  appName: 'EditorFlow',

  webDir: 'public',

  server: {
    url: 'https://editorflow-final-out.vercel.app',
    cleartext: false,
  },
};

export default config;