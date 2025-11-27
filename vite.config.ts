import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import tsconfigPaths from "vite-tsconfig-paths";
// import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// 🚫 Removed dotenv — not needed on Vercel

const disableHmr = process.env.DISABLE_HMR === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // traeBadgePlugin({
    //   variant: 'dark',
    //   position: 'bottom-right',
    //   prodOnly: true,
    //   clickable: true,
    //   clickUrl: 'https://www.trae.ai/solo?showJoin=1',
    //   autoTheme: true,
    //   autoThemeTarget: '#root'
    // }),
    // tsconfigPaths(),
  ],
  server: {
    host: 'localhost',
    port: 5174,
    strictPort: true,
    hmr: disableHmr
      ? false
      : {
          host: 'localhost',
          clientPort: 5174,
          port: 5174,
          protocol: 'ws',
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
})
