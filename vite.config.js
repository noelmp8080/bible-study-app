import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

const gitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'dev'; }
})();

export default defineConfig({
  define: {
    // Inlined at build time — readable in the app as __COMMIT_HASH__
    __COMMIT_HASH__: JSON.stringify(gitHash),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Study Bible',
        short_name: 'Study Bible',
        description: 'KJV Bible with highlights, notes, and AI Scholar',
        theme_color: '#060c1c',
        background_color: '#060c1c',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6000000,
      },
    })
  ],
  base: '/',
})
