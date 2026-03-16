// vite.config.ts
import { defineConfig } from "file:///e:/trollcity-1/node_modules/vite/dist/node/index.js";
import react from "file:///e:/trollcity-1/node_modules/@vitejs/plugin-react/dist/index.js";
import tsconfigPaths from "file:///e:/trollcity-1/node_modules/vite-tsconfig-paths/dist/index.js";
import { VitePWA } from "file:///e:/trollcity-1/node_modules/vite-plugin-pwa/dist/index.js";
import mkcert from "file:///e:/trollcity-1/node_modules/vite-plugin-mkcert/dist/mkcert.mjs";
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
    mkcert(),
    // Enable HTTPS for WebRTC (camera/mic access)
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
    // Enable LAN access (required for WebRTC on mobile devices)
    https: {},
    // Enable HTTPS for WebRTC - mkcert auto-generates certificates
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJlOlxcXFx0cm9sbGNpdHktMVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiZTpcXFxcdHJvbGxjaXR5LTFcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2U6L3Ryb2xsY2l0eS0xL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJ1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgbWtjZXJ0IGZyb20gJ3ZpdGUtcGx1Z2luLW1rY2VydCdcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcclxuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xyXG5cclxuLy8gXHVEODNEXHVERUFCIFJlbW92ZWQgZG90ZW52IFx1MjAxNCBub3QgbmVlZGVkIG9uIFZlcmNlbFxyXG5cclxuLy8gSFRUUFMgaXMgUkVRVUlSRUQgZm9yIFdlYlJUQyAoY2FtZXJhL21pY3JvcGhvbmUgYWNjZXNzKVxyXG4vLyBCcm93c2VycyBibG9jayBnZXRVc2VyTWVkaWEoKSBvbiBIVFRQIGV4Y2VwdCBsb2NhbGhvc3RcclxuLy8gVGhpcyBjb25maWd1cmF0aW9uIGVuYWJsZXMgSFRUUFMgdmlhIG1rY2VydCBmb3IgbG9jYWwgZGV2ZWxvcG1lbnRcclxuLy8gV2ViUlRDIHNlY3VyaXR5OiBNb2Rlcm4gYnJvd3NlcnMgcmVxdWlyZSBzZWN1cmUgY29udGV4dCAoSFRUUFMpIGZvciBjYW1lcmEvbWljIGFjY2Vzc1xyXG4vL1xyXG4vLyBta2NlcnQgYXV0by1nZW5lcmF0ZXMgY2VydGlmaWNhdGVzIGZvciBsb2NhbGhvc3QgYW5kIDEyNy4wLjAuMVxyXG4vLyBObyBtYW51YWwgY2VydGlmaWNhdGUgc2V0dXAgbmVlZGVkIC0ganVzdCBydW4gYG5wbSBydW4gZGV2YFxyXG5cclxuY29uc3QgZGlzYWJsZUhtciA9IHByb2Nlc3MuZW52LkRJU0FCTEVfSE1SID09PSAnMSdcclxuXHJcbi8vIFJlYWQgdmVyc2lvbi5qc29uXHJcbmxldCBhcHBWZXJzaW9uID0gJzEuMC4wJztcclxubGV0IGJ1aWxkVGltZSA9IERhdGUubm93KCk7XHJcbnRyeSB7XHJcbiAgY29uc3QgdmVyc2lvblBhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAncHVibGljL3ZlcnNpb24uanNvbicpO1xyXG4gIGlmIChmcy5leGlzdHNTeW5jKHZlcnNpb25QYXRoKSkge1xyXG4gICAgY29uc3QgdmVyc2lvbkRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh2ZXJzaW9uUGF0aCwgJ3V0Zi04JykpO1xyXG4gICAgYXBwVmVyc2lvbiA9IHZlcnNpb25EYXRhLnZlcnNpb24gfHwgJzEuMC4wJztcclxuICAgIGJ1aWxkVGltZSA9IHZlcnNpb25EYXRhLmJ1aWxkVGltZSB8fCBEYXRlLm5vdygpO1xyXG4gIH1cclxufSBjYXRjaCAoZXJyb3IpIHtcclxuICBjb25zb2xlLndhcm4oJ0NvdWxkIG5vdCByZWFkIHZlcnNpb24uanNvbiBpbiB2aXRlLmNvbmZpZy50cycsIGVycm9yKTtcclxufVxyXG5cclxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlOiBfbW9kZSB9KSA9PiAoe1xyXG4gIGVudkRpcjogX19kaXJuYW1lLFxyXG4gIGRlZmluZToge1xyXG4gICAgZ2xvYmFsOiAnd2luZG93JyxcclxuICAgIF9fQVBQX1ZFUlNJT05fXzogSlNPTi5zdHJpbmdpZnkoYXBwVmVyc2lvbiksXHJcbiAgICBfX0JVSUxEX1RJTUVfXzogSlNPTi5zdHJpbmdpZnkoYnVpbGRUaW1lKSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICBta2NlcnQoKSwgLy8gRW5hYmxlIEhUVFBTIGZvciBXZWJSVEMgKGNhbWVyYS9taWMgYWNjZXNzKVxyXG4gICAgdHNjb25maWdQYXRocygpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXHJcbiAgICAgIGluY2x1ZGVBc3NldHM6IFtcImZhdmljb24uaWNvXCIsIFwicm9ib3RzLnR4dFwiLCBcImFwcGxlLXRvdWNoLWljb24ucG5nXCJdLFxyXG4gICAgICBkZXZPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gS2VlcCBQV0Egb2ZmIGJ5IGRlZmF1bHQgaW4gZGV2OyBvcHQtaW4gYnkgc2V0dGluZyBgVklURV9QV0FfREVWPTFgXHJcbiAgICAgICAgZW5hYmxlZDogcHJvY2Vzcy5lbnYuVklURV9QV0FfREVWID09PSAnMSdcclxuICAgICAgfSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiBcIlRyb2xsIENpdHlcIixcclxuICAgICAgICBzaG9ydF9uYW1lOiBcIlRyb2xsQ2l0eVwiLFxyXG4gICAgICAgIHN0YXJ0X3VybDogXCIvbW9iaWxlXCIsXHJcbiAgICAgICAgc2NvcGU6IFwiL1wiLFxyXG4gICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzA1MDEwYVwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiM2YTAwZmZcIixcclxuICAgICAgICBvcmllbnRhdGlvbjogXCJwb3J0cmFpdFwiLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSB1bHRpbWF0ZSBsaXZlIHN0cmVhbWluZyAmIHNvY2lhbCBjb2luIGVjb25vbXkgcGxhdGZvcm0uXCIsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHsgXCJzcmNcIjogXCIvaWNvbnMvaWNvbi0xOTIucG5nXCIsIFwic2l6ZXNcIjogXCIxOTJ4MTkyXCIsIFwidHlwZVwiOiBcImltYWdlL3BuZ1wiIH0sXHJcbiAgICAgICAgICB7IFwic3JjXCI6IFwiL2ljb25zL2ljb24tNTEyLnBuZ1wiLCBcInNpemVzXCI6IFwiNTEyeDUxMlwiLCBcInR5cGVcIjogXCJpbWFnZS9wbmdcIiB9LFxyXG4gICAgICAgICAgeyBcInNyY1wiOiBcIi9pY29ucy9pY29uLTUxMi1tYXNrYWJsZS5wbmdcIiwgXCJzaXplc1wiOiBcIjUxMng1MTJcIiwgXCJ0eXBlXCI6IFwiaW1hZ2UvcG5nXCIsIFwicHVycG9zZVwiOiBcIm1hc2thYmxlXCIgfVxyXG4gICAgICAgIF1cclxuICAgICAgfSxcclxuICAgICAgLy8gVXNlIGluamVjdE1hbmlmZXN0IHNvIHdlIHNoaXAgYSBsb2NhbCwgYXVkaXRlZCBzZXJ2aWNlIHdvcmtlciByYXRoZXJcclxuICAgICAgLy8gdGhhbiByZWx5aW5nIG9uIENETiBpbXBvcnRTY3JpcHRzLiBUaGUgY3VzdG9tIHN3IGF0IGBzcmMvc2VydmljZS13b3JrZXIudHNgXHJcbiAgICAgIC8vIGltcGxlbWVudHMgcHVzaCwgb2ZmbGluZSBmYWxsYmFjayBhbmQgc2FmZSBuYXZpZ2F0aW9uIGhhbmRsaW5nLlxyXG4gICAgICBpbmplY3RSZWdpc3RlcjogJ2F1dG8nLFxyXG4gICAgICBzdHJhdGVnaWVzOiAnaW5qZWN0TWFuaWZlc3QnLFxyXG4gICAgICBzcmNEaXI6ICdzcmMnLFxyXG4gICAgICBmaWxlbmFtZTogJ3NlcnZpY2Utd29ya2VyLnRzJyxcclxuICAgICAgaW5qZWN0TWFuaWZlc3Q6IHtcclxuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmd9J10sXHJcbiAgICAgICAgZ2xvYklnbm9yZXM6IFsnaW5kZXguaHRtbCddLFxyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAxMDAwMDAwMCxcclxuICAgICAgfSxcclxuICAgICAgd29ya2JveDoge1xyXG4gICAgICAgIGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcclxuICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXHJcbiAgICAgICAgLy8gRGlzYWJsZWQgc2tpcFdhaXRpbmcgdG8gcHJldmVudCB1bmV4cGVjdGVkIHBhZ2UgcmVsb2Fkc1xyXG4gICAgICAgIC8vIFRoZSBwYWdlIHdpbGwgb25seSByZWxvYWQgd2hlbiB1c2VyIGV4cGxpY2l0bHkgcmVmcmVzaGVzIG9yIHdoZW4gbmVlZGVkXHJcbiAgICAgICAgc2tpcFdhaXRpbmc6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgXSxcclxuICBiYXNlOiAnLycsXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiB0cnVlLCAvLyBFbmFibGUgTEFOIGFjY2VzcyAocmVxdWlyZWQgZm9yIFdlYlJUQyBvbiBtb2JpbGUgZGV2aWNlcylcclxuICAgIGh0dHBzOiB7fSwgLy8gRW5hYmxlIEhUVFBTIGZvciBXZWJSVEMgLSBta2NlcnQgYXV0by1nZW5lcmF0ZXMgY2VydGlmaWNhdGVzXHJcbiAgICBwb3J0OiA1MTc4LFxyXG4gICAgc3RyaWN0UG9ydDogZmFsc2UsXHJcbiAgICBobXI6IGRpc2FibGVIbXIgPyBmYWxzZSA6IHsgb3ZlcmxheTogZmFsc2UgfSxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvYXBpJzoge1xyXG4gICAgICAgIHRhcmdldDogYGh0dHA6Ly9sb2NhbGhvc3Q6JHtwcm9jZXNzLmVudi5QT1JUIHx8IDMwMDF9YCxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcclxuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Byb3h5IGVycm9yJywgZXJyKVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxLCBfcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZW5kaW5nIFJlcXVlc3QgdG8gVGFyZ2V0OicsIHJlcS5tZXRob2QsIHJlcS51cmwpXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHByb3h5UmVzLCByZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXHJcbiAgICAgICAgICAgICAgJ1JlY2VpdmVkIFJlc3BvbnNlIGZyb20gVGFyZ2V0OicsXHJcbiAgICAgICAgICAgICAgcHJveHlSZXMuc3RhdHVzQ29kZSxcclxuICAgICAgICAgICAgICByZXEudXJsXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgJy9zdHJlYW1zJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vY2RuLm1haXRyb2xsY2l0eS5jb20nLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IHRydWUsXHJcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgsXHJcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXMnLCAocHJveHlSZXMsIHJlcSwgcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChyZXEudXJsICYmIHJlcS51cmwuaW5jbHVkZXMoJy5tM3U4JykgJiYgcHJveHlSZXMuaGVhZGVyc1snY29udGVudC10eXBlJ10/LmluY2x1ZGVzKCd0ZXh0L2h0bWwnKSkge1xyXG4gICAgICAgICAgICAgIHByb3h5UmVzLmRlc3Ryb3koKTsgXHJcbiAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcclxuICAgICAgICAgICAgICByZXMuZW5kKCdOb3QgRm91bmQgKEJsb2NrZWQgSFRNTCByZXNwb25zZSBmb3IgbTN1OCknKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxyXG4gICAgc291cmNlbWFwOiB0cnVlLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IChpZCkgPT4ge1xyXG4gICAgICAgICAgLy8gVmVuZG9yIGNodW5rcyBmb3Igc3RhYmxlIGRlcGVuZGVuY2llc1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3JlYWN0JykgfHwgaWQuaW5jbHVkZXMoJ3JlYWN0LWRvbScpIHx8IGlkLmluY2x1ZGVzKCdyZWFjdC1yb3V0ZXItZG9tJykgfHwgaWQuaW5jbHVkZXMoJ3p1c3RhbmQnKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BzdXBhYmFzZScpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuICdzdXBhYmFzZSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdmcmFtZXItbW90aW9uJykgfHwgaWQuaW5jbHVkZXMoJ2x1Y2lkZS1yZWFjdCcpIHx8IGlkLmluY2x1ZGVzKCdjbHN4JykgfHwgaWQuaW5jbHVkZXMoJ3RhaWx3aW5kLW1lcmdlJykgfHwgaWQuaW5jbHVkZXMoJ3Nvbm5lcicpIHx8IGlkLmluY2x1ZGVzKCdyZWNoYXJ0cycpIHx8IGlkLmluY2x1ZGVzKCdyZWFjdC1zd2lwZWFibGUnKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndWknO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIC8vIEdyb3VwIGFkbWluIHBhZ2VzIGludG8gYSBzdGFibGUgY2h1bmsgdG8gcmVkdWNlIFBXQSB1cGRhdGUgZXJyb3JzXHJcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3NyYy9wYWdlcy9hZG1pbicpIHx8IGlkLmluY2x1ZGVzKCdzcmNcXFxccGFnZXNcXFxcYWRtaW4nKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2FkbWluLWNvcmUnO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjJyksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWdPLFNBQVMsb0JBQW9CO0FBQzdQLE9BQU8sV0FBVztBQUNsQixPQUFPLG1CQUFtQjtBQUMxQixTQUFTLGVBQWU7QUFDeEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sVUFBVTtBQUNqQixPQUFPLFFBQVE7QUFOZixJQUFNLG1DQUFtQztBQWtCekMsSUFBTSxhQUFhLFFBQVEsSUFBSSxnQkFBZ0I7QUFHL0MsSUFBSSxhQUFhO0FBQ2pCLElBQUksWUFBWSxLQUFLLElBQUk7QUFDekIsSUFBSTtBQUNGLFFBQU0sY0FBYyxLQUFLLFFBQVEsa0NBQVcscUJBQXFCO0FBQ2pFLE1BQUksR0FBRyxXQUFXLFdBQVcsR0FBRztBQUM5QixVQUFNLGNBQWMsS0FBSyxNQUFNLEdBQUcsYUFBYSxhQUFhLE9BQU8sQ0FBQztBQUNwRSxpQkFBYSxZQUFZLFdBQVc7QUFDcEMsZ0JBQVksWUFBWSxhQUFhLEtBQUssSUFBSTtBQUFBLEVBQ2hEO0FBQ0YsU0FBUyxPQUFPO0FBQ2QsVUFBUSxLQUFLLGlEQUFpRCxLQUFLO0FBQ3JFO0FBR0EsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxNQUFNLE1BQU0sT0FBTztBQUFBLEVBQ2hELFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxJQUNOLFFBQVE7QUFBQSxJQUNSLGlCQUFpQixLQUFLLFVBQVUsVUFBVTtBQUFBLElBQzFDLGdCQUFnQixLQUFLLFVBQVUsU0FBUztBQUFBLEVBQzFDO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUE7QUFBQSxJQUNQLGNBQWM7QUFBQSxJQUNkLFFBQVE7QUFBQSxNQUNOLGNBQWM7QUFBQSxNQUNkLGVBQWUsQ0FBQyxlQUFlLGNBQWMsc0JBQXNCO0FBQUEsTUFDbkUsWUFBWTtBQUFBO0FBQUEsUUFFVixTQUFTLFFBQVEsSUFBSSxpQkFBaUI7QUFBQSxNQUN4QztBQUFBLE1BQ0EsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsU0FBUztBQUFBLFFBQ1Qsa0JBQWtCO0FBQUEsUUFDbEIsYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2IsT0FBTztBQUFBLFVBQ0wsRUFBRSxPQUFPLHVCQUF1QixTQUFTLFdBQVcsUUFBUSxZQUFZO0FBQUEsVUFDeEUsRUFBRSxPQUFPLHVCQUF1QixTQUFTLFdBQVcsUUFBUSxZQUFZO0FBQUEsVUFDeEUsRUFBRSxPQUFPLGdDQUFnQyxTQUFTLFdBQVcsUUFBUSxhQUFhLFdBQVcsV0FBVztBQUFBLFFBQzFHO0FBQUEsTUFDRjtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BSUEsZ0JBQWdCO0FBQUEsTUFDaEIsWUFBWTtBQUFBLE1BQ1osUUFBUTtBQUFBLE1BQ1IsVUFBVTtBQUFBLE1BQ1YsZ0JBQWdCO0FBQUEsUUFDZCxjQUFjLENBQUMsZ0NBQWdDO0FBQUEsUUFDL0MsYUFBYSxDQUFDLFlBQVk7QUFBQSxRQUMxQiwrQkFBK0I7QUFBQSxNQUNqQztBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsdUJBQXVCO0FBQUEsUUFDdkIsY0FBYztBQUFBO0FBQUE7QUFBQSxRQUdkLGFBQWE7QUFBQSxNQUNmO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixPQUFPLENBQUM7QUFBQTtBQUFBLElBQ1IsTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osS0FBSyxhQUFhLFFBQVEsRUFBRSxTQUFTLE1BQU07QUFBQSxJQUMzQyxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRLG9CQUFvQixRQUFRLElBQUksUUFBUSxJQUFJO0FBQUEsUUFDcEQsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsV0FBVyxDQUFDLE9BQU8sYUFBYTtBQUM5QixnQkFBTSxHQUFHLFNBQVMsQ0FBQyxLQUFLLE1BQU0sU0FBUztBQUNyQyxvQkFBUSxJQUFJLGVBQWUsR0FBRztBQUFBLFVBQ2hDLENBQUM7QUFDRCxnQkFBTSxHQUFHLFlBQVksQ0FBQyxVQUFVLEtBQUssU0FBUztBQUM1QyxvQkFBUSxJQUFJLDhCQUE4QixJQUFJLFFBQVEsSUFBSSxHQUFHO0FBQUEsVUFDL0QsQ0FBQztBQUNELGdCQUFNLEdBQUcsWUFBWSxDQUFDLFVBQVUsS0FBSyxTQUFTO0FBQzVDLG9CQUFRO0FBQUEsY0FDTjtBQUFBLGNBQ0EsU0FBUztBQUFBLGNBQ1QsSUFBSTtBQUFBLFlBQ047QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUFBLE1BQ0EsWUFBWTtBQUFBLFFBQ1YsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsU0FBUyxDQUFDQSxVQUFTQTtBQUFBLFFBQ25CLFdBQVcsQ0FBQyxPQUFPLGFBQWE7QUFDOUIsZ0JBQU0sR0FBRyxZQUFZLENBQUMsVUFBVSxLQUFLLFFBQVE7QUFDM0MsZ0JBQUksSUFBSSxPQUFPLElBQUksSUFBSSxTQUFTLE9BQU8sS0FBSyxTQUFTLFFBQVEsY0FBYyxHQUFHLFNBQVMsV0FBVyxHQUFHO0FBQ25HLHVCQUFTLFFBQVE7QUFDakIsa0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLGFBQWEsQ0FBQztBQUNuRCxrQkFBSSxJQUFJLDRDQUE0QztBQUFBLFlBQ3REO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsV0FBVztBQUFBLElBQ1gsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYyxDQUFDLE9BQU87QUFFcEIsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLGdCQUFJLEdBQUcsU0FBUyxPQUFPLEtBQUssR0FBRyxTQUFTLFdBQVcsS0FBSyxHQUFHLFNBQVMsa0JBQWtCLEtBQUssR0FBRyxTQUFTLFNBQVMsR0FBRztBQUNqSCxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsV0FBVyxHQUFHO0FBQzVCLHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxlQUFlLEtBQUssR0FBRyxTQUFTLGNBQWMsS0FBSyxHQUFHLFNBQVMsTUFBTSxLQUFLLEdBQUcsU0FBUyxnQkFBZ0IsS0FBSyxHQUFHLFNBQVMsUUFBUSxLQUFLLEdBQUcsU0FBUyxVQUFVLEtBQUssR0FBRyxTQUFTLGlCQUFpQixHQUFHO0FBQzdNLHFCQUFPO0FBQUEsWUFDVDtBQUFBLFVBQ0Y7QUFHQSxjQUFJLEdBQUcsU0FBUyxpQkFBaUIsS0FBSyxHQUFHLFNBQVMsbUJBQW1CLEdBQUc7QUFDdEUsbUJBQU87QUFBQSxVQUNUO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsS0FBSztBQUFBLElBQ3BDO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbInBhdGgiXQp9Cg==
