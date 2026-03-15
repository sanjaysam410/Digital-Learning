import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      devOptions: {
        enabled: false,
        type: 'module',
      },
      manifest: {
        name: 'Vidya Setu Digital Learning',
        short_name: 'Vidya Setu',
        description: 'Offline-first digital learning platform for rural schools',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        icons: [
          {
            src: 'vite.svg', // using placeholder
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg', // using placeholder
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
});
