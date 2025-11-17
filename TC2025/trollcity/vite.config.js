import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,gif}'],
        maximumFileSizeToCacheInBytes: 3000000, // 3MB limit
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.supabase\.io/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      manifest: {
        name: 'TrollCity',
        short_name: 'TrollCity',
        description: 'Join the ultimate streaming community - TrollCity!',
        theme_color: '#7c3aed',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ],
        categories: ['entertainment', 'social', 'video'],
        screenshots: [
          {
            src: '/screenshots/desktop-screenshot.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'TrollCity Desktop Interface'
          },
          {
            src: '/screenshots/mobile-screenshot.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'TrollCity Mobile Interface'
          }
        ],
        shortcuts: [
          {
            name: 'Go Live',
            short_name: 'Go Live',
            description: 'Start streaming live',
            url: '/golive',
            icons: [{ src: '/icons/go-live.png', sizes: '192x192' }]
          },
          {
            name: 'Store',
            short_name: 'Store',
            description: 'Visit the TrollCity store',
            url: '/store',
            icons: [{ src: '/icons/store.png', sizes: '192x192' }]
          },
          {
            name: 'Earnings',
            short_name: 'Earnings',
            description: 'Check your earnings',
            url: '/earnings',
            icons: [{ src: '/icons/earnings.png', sizes: '192x192' }]
          }
        ],
        related_applications: [
          {
            platform: 'play',
            url: 'https://play.google.com/store/apps/details?id=com.trollcity.app',
            id: 'com.trollcity.app'
          },
          {
            platform: 'itunes',
            url: 'https://apps.apple.com/us/app/trollcity/id1234567890',
            id: '1234567890'
          }
        ],
        prefer_related_applications: false
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      injectRegister: 'auto',
      strategies: 'generateSW'
    })
  ],
  server: {
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Use package resolution for Supabase; avoid hardcoded ESM file path
    },
    // Prevent multiple copies of React or React Query from being bundled
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  ssr: {
    noExternal: ['@supabase/supabase-js']
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
})
