import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
// import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// 🚫 Removed dotenv — not needed on Vercel

const disableHmr = process.env.DISABLE_HMR === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  base: '/',
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: false,
    hmr: disableHmr
      ? false
      : {
          host: 'localhost',
          overlay: false
        },
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
    assetsDir: 'assets'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
