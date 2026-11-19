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
        name: 'The Bible Study App',
        short_name: 'Bible Study',
        description: 'Read, search and study the Bible offline, with highlights, notes, reading plans and an AI study assistant.',
        // "The Journal" paper tone; no orientation lock, so tablets and desktops rotate freely.
        theme_color: '#faf9f6',
        background_color: '#faf9f6',
        display: 'standalone',
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
        // The app shell, bundled fonts and icons are precached. The Bible text
        // is not: it is downloaded once and kept in IndexedDB (see src/lib/bible.js).
        globPatterns: ['**/*.{js,css,html,woff2,png,ico}'],
        // Only Latin font subsets are precached; the others load on demand if ever needed.
        globIgnores: ['data/**', '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        maximumFileSizeToCacheInBytes: 3000000,
        navigateFallbackDenylist: [new RegExp('^/data/')],
        runtimeCaching: [
          {
            // Study datasets (cross-references, lexicon), fetched on demand.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/data/study/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'study-data', expiration: { maxEntries: 200 } },
          },
          {
            // ASV chapters: public-domain text that never changes.
            urlPattern: ({ url }) => url.origin === 'https://bible-api.com',
            handler: 'CacheFirst',
            options: { cacheName: 'bible-api', expiration: { maxEntries: 1300 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    })
  ],
  base: '/',
})
