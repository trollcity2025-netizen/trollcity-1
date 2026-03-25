import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// 🚫 Removed dotenv — not needed on Vercel

// HTTPS is REQUIRED for WebRTC (camera/microphone access)
// Browsers block getUserMedia() on HTTP except localhost
// This configuration enables HTTPS via mkcert for local development
// WebRTC security: Modern browsers require secure context (HTTPS) for camera/mic access
//
// mkcert auto-generates certificates for localhost and 127.0.0.1
// No manual certificate setup needed - just run `npm run dev`

const disableHmr = process.env.DISABLE_HMR === '1'

// Read version.json
let appVersion = '1.0.0';
let buildTime = Date.now();
try {
  const versionPath = path.resolve(__dirname, 'public/version.json');
  if (fs.existsSync(versionPath)) {
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    appVersion = versionData.version || '1.0.0';
    buildTime = versionData.buildTime || Date.now();
  }
} catch (error) {
  console.warn('Could not read version.json in vite.config.ts', error);
}

// https://vite.dev/config/
export default defineConfig(({ mode: _mode }) => ({
  envDir: __dirname,
  define: {
    global: 'window',
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    // mkcert removed - using HTTP for LAN access
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      devOptions: {
        // Keep PWA off by default in dev; opt-in by setting `VITE_PWA_DEV=1`
        enabled: process.env.VITE_PWA_DEV === '1'
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
          { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
          { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
          { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
          { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
          { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
          { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
          { "src": "/icons/icon-256.png", "sizes": "256x256", "type": "image/png" },
          { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
          { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
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
        globIgnores: ['index.html', 'OneSignalSDKWorker.js'],
        maximumFileSizeToCacheInBytes: 10000000,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Disabled skipWaiting to prevent unexpected page reloads
        // The page will only reload when user explicitly refreshes or when needed
        skipWaiting: false,
      },
    }),
  ],
  base: '/',
  server: {
    host: true, // Enable LAN access
    https: false, // Using HTTP for LAN access
    port: 5178,
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
      '/streams': {
        target: 'https://cdn.maitrollcity.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (req.url && req.url.includes('.m3u8') && proxyRes.headers['content-type']?.includes('text/html')) {
              proxyRes.destroy(); 
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not Found (Blocked HTML response for m3u8)');
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Disable sourcemaps in production for smaller bundles
    minify: 'terser', // Use Terser for better minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2, // Multiple compression passes
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false, // Remove comments
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for stable dependencies
          if (id.includes('node_modules')) {
            // Core React ecosystem - loaded first
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('zustand')) {
              return 'vendor-react';
            }
            // Supabase - separate chunk for DB operations
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // UI libraries - loaded on demand
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('sonner') || id.includes('recharts') || id.includes('react-swipeable')) {
              return 'vendor-ui';
            }
            // 3D and heavy libraries - lazy loaded
            if (id.includes('@babylonjs') || id.includes('three') || id.includes('@react-three') || id.includes('gsap')) {
              return 'vendor-3d';
            }
            // Media libraries
            if (id.includes('hls.js') || id.includes('livekit') || id.includes('socket.io')) {
              return 'vendor-media';
            }
            // Payment and external SDKs
            if (id.includes('@stripe') || id.includes('@paypal') || id.includes('stripe')) {
              return 'vendor-payment';
            }
          }
          
          // Group admin pages into a stable chunk to reduce PWA update errors
          if (id.includes('src/pages/admin') || id.includes('src\\pages\\admin')) {
            return 'admin-core';
          }
          
          // Group broadcast components
          if (id.includes('src/components/broadcast') || id.includes('src\\components\\broadcast')) {
            return 'broadcast-components';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1500, // Increase limit for larger chunks
    reportCompressedSize: true, // Report compressed sizes
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}))
