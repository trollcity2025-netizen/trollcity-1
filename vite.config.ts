import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'
// import mkcert from 'vite-plugin-mkcert'
// import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// 🚫 Removed dotenv — not needed on Vercel

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
  define: {
    global: 'window',
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    tsconfigPaths(),
    // mkcert(), // DISABLED for HTTP-only mode
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
    host: '0.0.0.0',
    port: 5176,
    strictPort: false,
    hmr: disableHmr ? false : { overlay: false },
    // https: false, // Force HTTP (Default is false, explicit false causes TS error)
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
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for stable dependencies
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('zustand')) {
              return 'vendor';
            }
            if (id.includes('livekit')) {
              return 'livekit';
            }
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('sonner') || id.includes('recharts') || id.includes('react-swipeable')) {
              return 'ui';
            }
          }
          
          // Group admin pages into a stable chunk to reduce PWA update errors
          if (id.includes('src/pages/admin') || id.includes('src\\pages\\admin')) {
            return 'admin-core';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}))
