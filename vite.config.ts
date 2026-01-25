import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import mkcert from 'vite-plugin-mkcert'
// import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// 🚫 Removed dotenv — not needed on Vercel

const disableHmr = process.env.DISABLE_HMR === '1'

// https://vite.dev/config/
export default defineConfig({
  define: {
    global: 'window',
  },
  plugins: [
    react(),
    tsconfigPaths(),
    mkcert(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      devOptions: {
        enabled: false
      },
      manifest: {
        name: "Troll City",
        short_name: "TrollCity",
        start_url: "/mobile",
        scope: "/",
        display: "standalone",
        background_color: "#05010a",
        theme_color: "#6a00ff",
        orientation: "portrait",
        description: "The ultimate live streaming & social coin economy platform.",
        icons: [
          { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
          { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
          { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
        ]
      },
      // Use injectManifest so we ship a local, audited service worker rather
      // than relying on CDN importScripts. The custom sw at `src/service-worker.ts`
      // implements push, offline fallback and safe navigation handling.
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['index.html'],
        maximumFileSizeToCacheInBytes: 10000000,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  base: '/',
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    hmr: disableHmr ? false : { overlay: false },
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT || 3001}`,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err)
          })
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to Target:', req.method, req.url)
          })
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(
              'Received Response from Target:',
              proxyRes.statusCode,
              req.url
            )
          })
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          livekit: ['livekit-client', '@livekit/components-react'],
          supabase: ['@supabase/supabase-js'],
          ui: ['framer-motion', 'lucide-react', 'sonner'],
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
