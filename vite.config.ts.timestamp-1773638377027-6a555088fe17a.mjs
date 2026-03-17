// vite.config.ts
import { defineConfig } from "file:///e:/trollcity-1/node_modules/vite/dist/node/index.js";
import react from "file:///e:/trollcity-1/node_modules/@vitejs/plugin-react/dist/index.js";
import tsconfigPaths from "file:///e:/trollcity-1/node_modules/vite-tsconfig-paths/dist/index.js";
import { VitePWA } from "file:///e:/trollcity-1/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
import fs from "fs";
var __vite_injected_original_dirname = "e:\\trollcity-1";
var disableHmr = process.env.DISABLE_HMR === "1";
var appVersion = "1.0.0";
var buildTime = Date.now();
try {
  const versionPath = path.resolve(__vite_injected_original_dirname, "public/version.json");
  if (fs.existsSync(versionPath)) {
    const versionData = JSON.parse(fs.readFileSync(versionPath, "utf-8"));
    appVersion = versionData.version || "1.0.0";
    buildTime = versionData.buildTime || Date.now();
  }
} catch (error) {
  console.warn("Could not read version.json in vite.config.ts", error);
}
var vite_config_default = defineConfig(({ mode: _mode }) => ({
  envDir: __vite_injected_original_dirname,
  define: {
    global: "window",
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime)
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
        enabled: process.env.VITE_PWA_DEV === "1"
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
      injectRegister: "auto",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        globIgnores: ["index.html"],
        maximumFileSizeToCacheInBytes: 1e7
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Disabled skipWaiting to prevent unexpected page reloads
        // The page will only reload when user explicitly refreshes or when needed
        skipWaiting: false
      }
    })
  ],
  base: "/",
  server: {
    host: true,
    // Enable LAN access
    https: false,
    // Using HTTP for LAN access
    port: 5178,
    strictPort: false,
    hmr: disableHmr ? false : { overlay: false },
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.PORT || 3001}`,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log(
              "Received Response from Target:",
              proxyRes.statusCode,
              req.url
            );
          });
        }
      },
      "/streams": {
        target: "https://cdn.maitrollcity.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path2) => path2,
        configure: (proxy, _options) => {
          proxy.on("proxyRes", (proxyRes, req, res) => {
            if (req.url && req.url.includes(".m3u8") && proxyRes.headers["content-type"]?.includes("text/html")) {
              proxyRes.destroy();
              res.writeHead(404, { "Content-Type": "text/plain" });
              res.end("Not Found (Blocked HTML response for m3u8)");
            }
          });
        }
      }
    }
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom") || id.includes("zustand")) {
              return "vendor";
            }
            if (id.includes("@supabase")) {
              return "supabase";
            }
            if (id.includes("framer-motion") || id.includes("lucide-react") || id.includes("clsx") || id.includes("tailwind-merge") || id.includes("sonner") || id.includes("recharts") || id.includes("react-swipeable")) {
              return "ui";
            }
          }
          if (id.includes("src/pages/admin") || id.includes("src\\pages\\admin")) {
            return "admin-core";
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJlOlxcXFx0cm9sbGNpdHktMVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiZTpcXFxcdHJvbGxjaXR5LTFcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2U6L3Ryb2xsY2l0eS0xL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJ1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5pbXBvcnQgZnMgZnJvbSAnZnMnXHJcblxyXG4vLyBcdUQ4M0RcdURFQUIgUmVtb3ZlZCBkb3RlbnYgXHUyMDE0IG5vdCBuZWVkZWQgb24gVmVyY2VsXHJcblxyXG4vLyBIVFRQUyBpcyBSRVFVSVJFRCBmb3IgV2ViUlRDIChjYW1lcmEvbWljcm9waG9uZSBhY2Nlc3MpXHJcbi8vIEJyb3dzZXJzIGJsb2NrIGdldFVzZXJNZWRpYSgpIG9uIEhUVFAgZXhjZXB0IGxvY2FsaG9zdFxyXG4vLyBUaGlzIGNvbmZpZ3VyYXRpb24gZW5hYmxlcyBIVFRQUyB2aWEgbWtjZXJ0IGZvciBsb2NhbCBkZXZlbG9wbWVudFxyXG4vLyBXZWJSVEMgc2VjdXJpdHk6IE1vZGVybiBicm93c2VycyByZXF1aXJlIHNlY3VyZSBjb250ZXh0IChIVFRQUykgZm9yIGNhbWVyYS9taWMgYWNjZXNzXHJcbi8vXHJcbi8vIG1rY2VydCBhdXRvLWdlbmVyYXRlcyBjZXJ0aWZpY2F0ZXMgZm9yIGxvY2FsaG9zdCBhbmQgMTI3LjAuMC4xXHJcbi8vIE5vIG1hbnVhbCBjZXJ0aWZpY2F0ZSBzZXR1cCBuZWVkZWQgLSBqdXN0IHJ1biBgbnBtIHJ1biBkZXZgXHJcblxyXG5jb25zdCBkaXNhYmxlSG1yID0gcHJvY2Vzcy5lbnYuRElTQUJMRV9ITVIgPT09ICcxJ1xyXG5cclxuLy8gUmVhZCB2ZXJzaW9uLmpzb25cclxubGV0IGFwcFZlcnNpb24gPSAnMS4wLjAnO1xyXG5sZXQgYnVpbGRUaW1lID0gRGF0ZS5ub3coKTtcclxudHJ5IHtcclxuICBjb25zdCB2ZXJzaW9uUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwdWJsaWMvdmVyc2lvbi5qc29uJyk7XHJcbiAgaWYgKGZzLmV4aXN0c1N5bmModmVyc2lvblBhdGgpKSB7XHJcbiAgICBjb25zdCB2ZXJzaW9uRGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHZlcnNpb25QYXRoLCAndXRmLTgnKSk7XHJcbiAgICBhcHBWZXJzaW9uID0gdmVyc2lvbkRhdGEudmVyc2lvbiB8fCAnMS4wLjAnO1xyXG4gICAgYnVpbGRUaW1lID0gdmVyc2lvbkRhdGEuYnVpbGRUaW1lIHx8IERhdGUubm93KCk7XHJcbiAgfVxyXG59IGNhdGNoIChlcnJvcikge1xyXG4gIGNvbnNvbGUud2FybignQ291bGQgbm90IHJlYWQgdmVyc2lvbi5qc29uIGluIHZpdGUuY29uZmlnLnRzJywgZXJyb3IpO1xyXG59XHJcblxyXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGU6IF9tb2RlIH0pID0+ICh7XHJcbiAgZW52RGlyOiBfX2Rpcm5hbWUsXHJcbiAgZGVmaW5lOiB7XHJcbiAgICBnbG9iYWw6ICd3aW5kb3cnLFxyXG4gICAgX19BUFBfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShhcHBWZXJzaW9uKSxcclxuICAgIF9fQlVJTERfVElNRV9fOiBKU09OLnN0cmluZ2lmeShidWlsZFRpbWUpLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIC8vIG1rY2VydCByZW1vdmVkIC0gdXNpbmcgSFRUUCBmb3IgTEFOIGFjY2Vzc1xyXG4gICAgdHNjb25maWdQYXRocygpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXHJcbiAgICAgIGluY2x1ZGVBc3NldHM6IFtcImZhdmljb24uaWNvXCIsIFwicm9ib3RzLnR4dFwiLCBcImFwcGxlLXRvdWNoLWljb24ucG5nXCJdLFxyXG4gICAgICBkZXZPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gS2VlcCBQV0Egb2ZmIGJ5IGRlZmF1bHQgaW4gZGV2OyBvcHQtaW4gYnkgc2V0dGluZyBgVklURV9QV0FfREVWPTFgXHJcbiAgICAgICAgZW5hYmxlZDogcHJvY2Vzcy5lbnYuVklURV9QV0FfREVWID09PSAnMSdcclxuICAgICAgfSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiBcIlRyb2xsIENpdHlcIixcclxuICAgICAgICBzaG9ydF9uYW1lOiBcIlRyb2xsQ2l0eVwiLFxyXG4gICAgICAgIHN0YXJ0X3VybDogXCIvbW9iaWxlXCIsXHJcbiAgICAgICAgc2NvcGU6IFwiL1wiLFxyXG4gICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzA1MDEwYVwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiM2YTAwZmZcIixcclxuICAgICAgICBvcmllbnRhdGlvbjogXCJwb3J0cmFpdFwiLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSB1bHRpbWF0ZSBsaXZlIHN0cmVhbWluZyAmIHNvY2lhbCBjb2luIGVjb25vbXkgcGxhdGZvcm0uXCIsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHsgXCJzcmNcIjogXCIvaWNvbnMvaWNvbi0xOTIucG5nXCIsIFwic2l6ZXNcIjogXCIxOTJ4MTkyXCIsIFwidHlwZVwiOiBcImltYWdlL3BuZ1wiIH0sXHJcbiAgICAgICAgICB7IFwic3JjXCI6IFwiL2ljb25zL2ljb24tNTEyLnBuZ1wiLCBcInNpemVzXCI6IFwiNTEyeDUxMlwiLCBcInR5cGVcIjogXCJpbWFnZS9wbmdcIiB9LFxyXG4gICAgICAgICAgeyBcInNyY1wiOiBcIi9pY29ucy9pY29uLTUxMi1tYXNrYWJsZS5wbmdcIiwgXCJzaXplc1wiOiBcIjUxMng1MTJcIiwgXCJ0eXBlXCI6IFwiaW1hZ2UvcG5nXCIsIFwicHVycG9zZVwiOiBcIm1hc2thYmxlXCIgfVxyXG4gICAgICAgIF1cclxuICAgICAgfSxcclxuICAgICAgLy8gVXNlIGluamVjdE1hbmlmZXN0IHNvIHdlIHNoaXAgYSBsb2NhbCwgYXVkaXRlZCBzZXJ2aWNlIHdvcmtlciByYXRoZXJcclxuICAgICAgLy8gdGhhbiByZWx5aW5nIG9uIENETiBpbXBvcnRTY3JpcHRzLiBUaGUgY3VzdG9tIHN3IGF0IGBzcmMvc2VydmljZS13b3JrZXIudHNgXHJcbiAgICAgIC8vIGltcGxlbWVudHMgcHVzaCwgb2ZmbGluZSBmYWxsYmFjayBhbmQgc2FmZSBuYXZpZ2F0aW9uIGhhbmRsaW5nLlxyXG4gICAgICBpbmplY3RSZWdpc3RlcjogJ2F1dG8nLFxyXG4gICAgICBzdHJhdGVnaWVzOiAnaW5qZWN0TWFuaWZlc3QnLFxyXG4gICAgICBzcmNEaXI6ICdzcmMnLFxyXG4gICAgICBmaWxlbmFtZTogJ3NlcnZpY2Utd29ya2VyLnRzJyxcclxuICAgICAgaW5qZWN0TWFuaWZlc3Q6IHtcclxuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmd9J10sXHJcbiAgICAgICAgZ2xvYklnbm9yZXM6IFsnaW5kZXguaHRtbCddLFxyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAxMDAwMDAwMCxcclxuICAgICAgfSxcclxuICAgICAgd29ya2JveDoge1xyXG4gICAgICAgIGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcclxuICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXHJcbiAgICAgICAgLy8gRGlzYWJsZWQgc2tpcFdhaXRpbmcgdG8gcHJldmVudCB1bmV4cGVjdGVkIHBhZ2UgcmVsb2Fkc1xyXG4gICAgICAgIC8vIFRoZSBwYWdlIHdpbGwgb25seSByZWxvYWQgd2hlbiB1c2VyIGV4cGxpY2l0bHkgcmVmcmVzaGVzIG9yIHdoZW4gbmVlZGVkXHJcbiAgICAgICAgc2tpcFdhaXRpbmc6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgXSxcclxuICBiYXNlOiAnLycsXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiB0cnVlLCAvLyBFbmFibGUgTEFOIGFjY2Vzc1xyXG4gICAgaHR0cHM6IGZhbHNlLCAvLyBVc2luZyBIVFRQIGZvciBMQU4gYWNjZXNzXHJcbiAgICBwb3J0OiA1MTc4LFxyXG4gICAgc3RyaWN0UG9ydDogZmFsc2UsXHJcbiAgICBobXI6IGRpc2FibGVIbXIgPyBmYWxzZSA6IHsgb3ZlcmxheTogZmFsc2UgfSxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvYXBpJzoge1xyXG4gICAgICAgIHRhcmdldDogYGh0dHA6Ly9sb2NhbGhvc3Q6JHtwcm9jZXNzLmVudi5QT1JUIHx8IDMwMDF9YCxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcclxuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Byb3h5IGVycm9yJywgZXJyKVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxLCBfcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZW5kaW5nIFJlcXVlc3QgdG8gVGFyZ2V0OicsIHJlcS5tZXRob2QsIHJlcS51cmwpXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHByb3h5UmVzLCByZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXHJcbiAgICAgICAgICAgICAgJ1JlY2VpdmVkIFJlc3BvbnNlIGZyb20gVGFyZ2V0OicsXHJcbiAgICAgICAgICAgICAgcHJveHlSZXMuc3RhdHVzQ29kZSxcclxuICAgICAgICAgICAgICByZXEudXJsXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgJy9zdHJlYW1zJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vY2RuLm1haXRyb2xsY2l0eS5jb20nLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IHRydWUsXHJcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgsXHJcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXMnLCAocHJveHlSZXMsIHJlcSwgcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChyZXEudXJsICYmIHJlcS51cmwuaW5jbHVkZXMoJy5tM3U4JykgJiYgcHJveHlSZXMuaGVhZGVyc1snY29udGVudC10eXBlJ10/LmluY2x1ZGVzKCd0ZXh0L2h0bWwnKSkge1xyXG4gICAgICAgICAgICAgIHByb3h5UmVzLmRlc3Ryb3koKTsgXHJcbiAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcclxuICAgICAgICAgICAgICByZXMuZW5kKCdOb3QgRm91bmQgKEJsb2NrZWQgSFRNTCByZXNwb25zZSBmb3IgbTN1OCknKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxyXG4gICAgc291cmNlbWFwOiB0cnVlLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IChpZCkgPT4ge1xyXG4gICAgICAgICAgLy8gVmVuZG9yIGNodW5rcyBmb3Igc3RhYmxlIGRlcGVuZGVuY2llc1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3JlYWN0JykgfHwgaWQuaW5jbHVkZXMoJ3JlYWN0LWRvbScpIHx8IGlkLmluY2x1ZGVzKCdyZWFjdC1yb3V0ZXItZG9tJykgfHwgaWQuaW5jbHVkZXMoJ3p1c3RhbmQnKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BzdXBhYmFzZScpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuICdzdXBhYmFzZSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdmcmFtZXItbW90aW9uJykgfHwgaWQuaW5jbHVkZXMoJ2x1Y2lkZS1yZWFjdCcpIHx8IGlkLmluY2x1ZGVzKCdjbHN4JykgfHwgaWQuaW5jbHVkZXMoJ3RhaWx3aW5kLW1lcmdlJykgfHwgaWQuaW5jbHVkZXMoJ3Nvbm5lcicpIHx8IGlkLmluY2x1ZGVzKCdyZWNoYXJ0cycpIHx8IGlkLmluY2x1ZGVzKCdyZWFjdC1zd2lwZWFibGUnKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndWknO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIC8vIEdyb3VwIGFkbWluIHBhZ2VzIGludG8gYSBzdGFibGUgY2h1bmsgdG8gcmVkdWNlIFBXQSB1cGRhdGUgZXJyb3JzXHJcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3NyYy9wYWdlcy9hZG1pbicpIHx8IGlkLmluY2x1ZGVzKCdzcmNcXFxccGFnZXNcXFxcYWRtaW4nKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2FkbWluLWNvcmUnO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjJyksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWdPLFNBQVMsb0JBQW9CO0FBQzdQLE9BQU8sV0FBVztBQUNsQixPQUFPLG1CQUFtQjtBQUMxQixTQUFTLGVBQWU7QUFDeEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sUUFBUTtBQUxmLElBQU0sbUNBQW1DO0FBaUJ6QyxJQUFNLGFBQWEsUUFBUSxJQUFJLGdCQUFnQjtBQUcvQyxJQUFJLGFBQWE7QUFDakIsSUFBSSxZQUFZLEtBQUssSUFBSTtBQUN6QixJQUFJO0FBQ0YsUUFBTSxjQUFjLEtBQUssUUFBUSxrQ0FBVyxxQkFBcUI7QUFDakUsTUFBSSxHQUFHLFdBQVcsV0FBVyxHQUFHO0FBQzlCLFVBQU0sY0FBYyxLQUFLLE1BQU0sR0FBRyxhQUFhLGFBQWEsT0FBTyxDQUFDO0FBQ3BFLGlCQUFhLFlBQVksV0FBVztBQUNwQyxnQkFBWSxZQUFZLGFBQWEsS0FBSyxJQUFJO0FBQUEsRUFDaEQ7QUFDRixTQUFTLE9BQU87QUFDZCxVQUFRLEtB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
