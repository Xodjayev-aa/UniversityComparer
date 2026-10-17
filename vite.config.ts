import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['icons/favicon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/mark.svg', 'robots.txt'],
      manifest: {
        id: '/',
        name: 'UniScope — university discovery and comparison',
        short_name: 'UniScope',
        description:
          'Find universities worldwide and compare sourced facts. Free, no account. Missing information is labelled, never invented.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f2ea',
        theme_color: '#0e2a2a',
        lang: 'en',
        dir: 'ltr',
        categories: ['education', 'reference'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Search universities', short_name: 'Search', url: '/search', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'My shortlist', short_name: 'Saved', url: '/shortlist', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Coverage and sources', short_name: 'Coverage', url: '/coverage', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The hosted preview proxies the dev server under a generated hostname.
    // Allow that host while keeping the API proxy server-side.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
});
