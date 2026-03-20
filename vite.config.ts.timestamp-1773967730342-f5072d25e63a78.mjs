// vite.config.ts
import { defineConfig } from "file:///E:/trollcity-1/node_modules/vite/dist/node/index.js";
import react from "file:///E:/trollcity-1/node_modules/@vitejs/plugin-react/dist/index.js";
import tsconfigPaths from "file:///E:/trollcity-1/node_modules/vite-tsconfig-paths/dist/index.js";
import { VitePWA } from "file:///E:/trollcity-1/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
import fs from "fs";
var __vite_injected_original_dirname = "E:\\trollcity-1";
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
    sourcemap: false,
    // Disable sourcemaps in production for smaller bundles
    minify: "terser",
    // Use Terser for better minification
    terserOptions: {
      compress: {
        drop_console: true,
        // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug"],
        passes: 2
        // Multiple compression passes
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
        // Remove comments
      }
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom") || id.includes("zustand")) {
              return "vendor-react";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            if (id.includes("framer-motion") || id.includes("lucide-react") || id.includes("clsx") || id.includes("tailwind-merge") || id.includes("sonner") || id.includes("recharts") || id.includes("react-swipeable")) {
              return "vendor-ui";
            }
            if (id.includes("@babylonjs") || id.includes("three") || id.includes("@react-three") || id.includes("gsap")) {
              return "vendor-3d";
            }
            if (id.includes("hls.js") || id.includes("livekit") || id.includes("socket.io")) {
              return "vendor-media";
            }
            if (id.includes("@stripe") || id.includes("@paypal") || id.includes("stripe")) {
              return "vendor-payment";
            }
          }
          if (id.includes("src/pages/admin") || id.includes("src\\pages\\admin")) {
            return "admin-core";
          }
          if (id.includes("src/components/broadcast") || id.includes("src\\components\\broadcast")) {
            return "broadcast-components";
          }
        }
      }
    },
    chunkSizeWarningLimit: 1500,
    // Increase limit for larger chunks
    reportCompressedSize: true
    // Report compressed sizes
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFx0cm9sbGNpdHktMVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcdHJvbGxjaXR5LTFcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L3Ryb2xsY2l0eS0xL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJ1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5pbXBvcnQgZnMgZnJvbSAnZnMnXHJcblxyXG4vLyBcdUQ4M0RcdURFQUIgUmVtb3ZlZCBkb3RlbnYgXHUyMDE0IG5vdCBuZWVkZWQgb24gVmVyY2VsXHJcblxyXG4vLyBIVFRQUyBpcyBSRVFVSVJFRCBmb3IgV2ViUlRDIChjYW1lcmEvbWljcm9waG9uZSBhY2Nlc3MpXHJcbi8vIEJyb3dzZXJzIGJsb2NrIGdldFVzZXJNZWRpYSgpIG9uIEhUVFAgZXhjZXB0IGxvY2FsaG9zdFxyXG4vLyBUaGlzIGNvbmZpZ3VyYXRpb24gZW5hYmxlcyBIVFRQUyB2aWEgbWtjZXJ0IGZvciBsb2NhbCBkZXZlbG9wbWVudFxyXG4vLyBXZWJSVEMgc2VjdXJpdHk6IE1vZGVybiBicm93c2VycyByZXF1aXJlIHNlY3VyZSBjb250ZXh0IChIVFRQUykgZm9yIGNhbWVyYS9taWMgYWNjZXNzXHJcbi8vXHJcbi8vIG1rY2VydCBhdXRvLWdlbmVyYXRlcyBjZXJ0aWZpY2F0ZXMgZm9yIGxvY2FsaG9zdCBhbmQgMTI3LjAuMC4xXHJcbi8vIE5vIG1hbnVhbCBjZXJ0aWZpY2F0ZSBzZXR1cCBuZWVkZWQgLSBqdXN0IHJ1biBgbnBtIHJ1biBkZXZgXHJcblxyXG5jb25zdCBkaXNhYmxlSG1yID0gcHJvY2Vzcy5lbnYuRElTQUJMRV9ITVIgPT09ICcxJ1xyXG5cclxuLy8gUmVhZCB2ZXJzaW9uLmpzb25cclxubGV0IGFwcFZlcnNpb24gPSAnMS4wLjAnO1xyXG5sZXQgYnVpbGRUaW1lID0gRGF0ZS5ub3coKTtcclxudHJ5IHtcclxuICBjb25zdCB2ZXJzaW9uUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwdWJsaWMvdmVyc2lvbi5qc29uJyk7XHJcbiAgaWYgKGZzLmV4aXN0c1N5bmModmVyc2lvblBhdGgpKSB7XHJcbiAgICBjb25zdCB2ZXJzaW9uRGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHZlcnNpb25QYXRoLCAndXRmLTgnKSk7XHJcbiAgICBhcHBWZXJzaW9uID0gdmVyc2lvbkRhdGEudmVyc2lvbiB8fCAnMS4wLjAnO1xyXG4gICAgYnVpbGRUaW1lID0gdmVyc2lvbkRhdGEuYnVpbGRUaW1lIHx8IERhdGUubm93KCk7XHJcbiAgfVxyXG59IGNhdGNoIChlcnJvcikge1xyXG4gIGNvbnNvbGUud2FybignQ291bGQgbm90IHJlYWQgdmVyc2lvbi5qc29uIGluIHZpdGUuY29uZmlnLnRzJywgZXJyb3IpO1xyXG59XHJcblxyXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGU6IF9tb2RlIH0pID0+ICh7XHJcbiAgZW52RGlyOiBfX2Rpcm5hbWUsXHJcbiAgZGVmaW5lOiB7XHJcbiAgICBnbG9iYWw6ICd3aW5kb3cnLFxyXG4gICAgX19BUFBfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShhcHBWZXJzaW9uKSxcclxuICAgIF9fQlVJTERfVElNRV9fOiBKU09OLnN0cmluZ2lmeShidWlsZFRpbWUpLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIC8vIG1rY2VydCByZW1vdmVkIC0gdXNpbmcgSFRUUCBmb3IgTEFOIGFjY2Vzc1xyXG4gICAgdHNjb25maWdQYXRocygpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXHJcbiAgICAgIGluY2x1ZGVBc3NldHM6IFtcImZhdmljb24uaWNvXCIsIFwicm9ib3RzLnR4dFwiLCBcImFwcGxlLXRvdWNoLWljb24ucG5nXCJdLFxyXG4gICAgICBkZXZPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gS2VlcCBQV0Egb2ZmIGJ5IGRlZmF1bHQgaW4gZGV2OyBvcHQtaW4gYnkgc2V0dGluZyBgVklURV9QV0FfREVWPTFgXHJcbiAgICAgICAgZW5hYmxlZDogcHJvY2Vzcy5lbnYuVklURV9QV0FfREVWID09PSAnMSdcclxuICAgICAgfSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiBcIlRyb2xsIENpdHlcIixcclxuICAgICAgICBzaG9ydF9uYW1lOiBcIlRyb2xsQ2l0eVwiLFxyXG4gICAgICAgIHN0YXJ0X3VybDogXCIvbW9iaWxlXCIsXHJcbiAgICAgICAgc2NvcGU6IFwiL1wiLFxyXG4gICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzA1MDEwYVwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiM2YTAwZmZcIixcclxuICAgICAgICBvcmllbnRhdGlvbjogXCJwb3J0cmFpdFwiLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSB1bHRpbWF0ZSBsaXZlIHN0cmVhbWluZyAmIHNvY2lhbCBjb2luIGVjb25vbXkgcGxhdGZvcm0uXCIsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHsgXCJzcmNcIjogXCIvaWNvbnMvaWNvbi0xOTIucG5nXCIsIFwic2l6ZXNcIjogXCIxOTJ4MTkyXCIsIFwidHlwZVwiOiBcImltYWdlL3BuZ1wiIH0sXHJcbiAgICAgICAgICB7IFwic3JjXCI6IFwiL2ljb25zL2ljb24tNTEyLnBuZ1wiLCBcInNpemVzXCI6IFwiNTEyeDUxMlwiLCBcInR5cGVcIjogXCJpbWFnZS9wbmdcIiB9LFxyXG4gICAgICAgICAgeyBcInNyY1wiOiBcIi9pY29ucy9pY29uLTUxMi1tYXNrYWJsZS5wbmdcIiwgXCJzaXplc1wiOiBcIjUxMng1MTJcIiwgXCJ0eXBlXCI6IFwiaW1hZ2UvcG5nXCIsIFwicHVycG9zZVwiOiBcIm1hc2thYmxlXCIgfVxyXG4gICAgICAgIF1cclxuICAgICAgfSxcclxuICAgICAgLy8gVXNlIGluamVjdE1hbmlmZXN0IHNvIHdlIHNoaXAgYSBsb2NhbCwgYXVkaXRlZCBzZXJ2aWNlIHdvcmtlciByYXRoZXJcclxuICAgICAgLy8gdGhhbiByZWx5aW5nIG9uIENETiBpbXBvcnRTY3JpcHRzLiBUaGUgY3VzdG9tIHN3IGF0IGBzcmMvc2VydmljZS13b3JrZXIudHNgXHJcbiAgICAgIC8vIGltcGxlbWVudHMgcHVzaCwgb2ZmbGluZSBmYWxsYmFjayBhbmQgc2FmZSBuYXZpZ2F0aW9uIGhhbmRsaW5nLlxyXG4gICAgICBpbmplY3RSZWdpc3RlcjogJ2F1dG8nLFxyXG4gICAgICBzdHJhdGVnaWVzOiAnaW5qZWN0TWFuaWZlc3QnLFxyXG4gICAgICBzcmNEaXI6ICdzcmMnLFxyXG4gICAgICBmaWxlbmFtZTogJ3NlcnZpY2Utd29ya2VyLnRzJyxcclxuICAgICAgaW5qZWN0TWFuaWZlc3Q6IHtcclxuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmd9J10sXHJcbiAgICAgICAgZ2xvYklnbm9yZXM6IFsnaW5kZXguaHRtbCddLFxyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAxMDAwMDAwMCxcclxuICAgICAgfSxcclxuICAgICAgd29ya2JveDoge1xyXG4gICAgICAgIGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcclxuICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXHJcbiAgICAgICAgLy8gRGlzYWJsZWQgc2tpcFdhaXRpbmcgdG8gcHJldmVudCB1bmV4cGVjdGVkIHBhZ2UgcmVsb2Fkc1xyXG4gICAgICAgIC8vIFRoZSBwYWdlIHdpbGwgb25seSByZWxvYWQgd2hlbiB1c2VyIGV4cGxpY2l0bHkgcmVmcmVzaGVzIG9yIHdoZW4gbmVlZGVkXHJcbiAgICAgICAgc2tpcFdhaXRpbmc6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgXSxcclxuICBiYXNlOiAnLycsXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiB0cnVlLCAvLyBFbmFibGUgTEFOIGFjY2Vzc1xyXG4gICAgaHR0cHM6IGZhbHNlLCAvLyBVc2luZyBIVFRQIGZvciBMQU4gYWNjZXNzXHJcbiAgICBwb3J0OiA1MTc4LFxyXG4gICAgc3RyaWN0UG9ydDogZmFsc2UsXHJcbiAgICBobXI6IGRpc2FibGVIbXIgPyBmYWxzZSA6IHsgb3ZlcmxheTogZmFsc2UgfSxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvYXBpJzoge1xyXG4gICAgICAgIHRhcmdldDogYGh0dHA6Ly9sb2NhbGhvc3Q6JHtwcm9jZXNzLmVudi5QT1JUIHx8IDMwMDF9YCxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcclxuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Byb3h5IGVycm9yJywgZXJyKVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxLCBfcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZW5kaW5nIFJlcXVlc3QgdG8gVGFyZ2V0OicsIHJlcS5tZXRob2QsIHJlcS51cmwpXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHByb3h5UmVzLCByZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXHJcbiAgICAgICAgICAgICAgJ1JlY2VpdmVkIFJlc3BvbnNlIGZyb20gVGFyZ2V0OicsXHJcbiAgICAgICAgICAgICAgcHJveHlSZXMuc3RhdHVzQ29kZSxcclxuICAgICAgICAgICAgICByZXEudXJsXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgJy9zdHJlYW1zJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vY2RuLm1haXRyb2xsY2l0eS5jb20nLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IHRydWUsXHJcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgsXHJcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXMnLCAocHJveHlSZXMsIHJlcSwgcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChyZXEudXJsICYmIHJlcS51cmwuaW5jbHVkZXMoJy5tM3U4JykgJiYgcHJveHlSZXMuaGVhZGVyc1snY29udGVudC10eXBlJ10/LmluY2x1ZGVzKCd0ZXh0L2h0bWwnKSkge1xyXG4gICAgICAgICAgICAgIHByb3h5UmVzLmRlc3Ryb3koKTsgXHJcbiAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcclxuICAgICAgICAgICAgICByZXMuZW5kKCdOb3QgRm91bmQgKEJsb2NrZWQgSFRNTCByZXNwb25zZSBmb3IgbTN1OCknKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxyXG4gICAgc291cmNlbWFwOiBmYWxzZSwgLy8gRGlzYWJsZSBzb3VyY2VtYXBzIGluIHByb2R1Y3Rpb24gZm9yIHNtYWxsZXIgYnVuZGxlc1xyXG4gICAgbWluaWZ5OiAndGVyc2VyJywgLy8gVXNlIFRlcnNlciBmb3IgYmV0dGVyIG1pbmlmaWNhdGlvblxyXG4gICAgdGVyc2VyT3B0aW9uczoge1xyXG4gICAgICBjb21wcmVzczoge1xyXG4gICAgICAgIGRyb3BfY29uc29sZTogdHJ1ZSwgLy8gUmVtb3ZlIGNvbnNvbGUubG9nIGluIHByb2R1Y3Rpb25cclxuICAgICAgICBkcm9wX2RlYnVnZ2VyOiB0cnVlLFxyXG4gICAgICAgIHB1cmVfZnVuY3M6IFsnY29uc29sZS5sb2cnLCAnY29uc29sZS5pbmZvJywgJ2NvbnNvbGUuZGVidWcnXSxcclxuICAgICAgICBwYXNzZXM6IDIsIC8vIE11bHRpcGxlIGNvbXByZXNzaW9uIHBhc3Nlc1xyXG4gICAgICB9LFxyXG4gICAgICBtYW5nbGU6IHtcclxuICAgICAgICBzYWZhcmkxMDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgZm9ybWF0OiB7XHJcbiAgICAgICAgY29tbWVudHM6IGZhbHNlLCAvLyBSZW1vdmUgY29tbWVudHNcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XHJcbiAgICAgICAgICAvLyBWZW5kb3IgY2h1bmtzIGZvciBzdGFibGUgZGVwZW5kZW5jaWVzXHJcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSB7XHJcbiAgICAgICAgICAgIC8vIENvcmUgUmVhY3QgZWNvc3lzdGVtIC0gbG9hZGVkIGZpcnN0XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVhY3QnKSB8fCBpZC5pbmNsdWRlcygncmVhY3QtZG9tJykgfHwgaWQuaW5jbHVkZXMoJ3JlYWN0LXJvdXRlci1kb20nKSB8fCBpZC5pbmNsdWRlcygnenVzdGFuZCcpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItcmVhY3QnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIFN1cGFiYXNlIC0gc2VwYXJhdGUgY2h1bmsgZm9yIERCIG9wZXJhdGlvbnNcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAc3VwYWJhc2UnKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXN1cGFiYXNlJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBVSSBsaWJyYXJpZXMgLSBsb2FkZWQgb24gZGVtYW5kXHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZnJhbWVyLW1vdGlvbicpIHx8IGlkLmluY2x1ZGVzKCdsdWNpZGUtcmVhY3QnKSB8fCBpZC5pbmNsdWRlcygnY2xzeCcpIHx8IGlkLmluY2x1ZGVzKCd0YWlsd2luZC1tZXJnZScpIHx8IGlkLmluY2x1ZGVzKCdzb25uZXInKSB8fCBpZC5pbmNsdWRlcygncmVjaGFydHMnKSB8fCBpZC5pbmNsdWRlcygncmVhY3Qtc3dpcGVhYmxlJykpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci11aSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gM0QgYW5kIGhlYXZ5IGxpYnJhcmllcyAtIGxhenkgbG9hZGVkXHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnQGJhYnlsb25qcycpIHx8IGlkLmluY2x1ZGVzKCd0aHJlZScpIHx8IGlkLmluY2x1ZGVzKCdAcmVhY3QtdGhyZWUnKSB8fCBpZC5pbmNsdWRlcygnZ3NhcCcpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItM2QnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIE1lZGlhIGxpYnJhcmllc1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2hscy5qcycpIHx8IGlkLmluY2x1ZGVzKCdsaXZla2l0JykgfHwgaWQuaW5jbHVkZXMoJ3NvY2tldC5pbycpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItbWVkaWEnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIFBheW1lbnQgYW5kIGV4dGVybmFsIFNES3NcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAc3RyaXBlJykgfHwgaWQuaW5jbHVkZXMoJ0BwYXlwYWwnKSB8fCBpZC5pbmNsdWRlcygnc3RyaXBlJykpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1wYXltZW50JztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgXHJcbiAgICAgICAgICAvLyBHcm91cCBhZG1pbiBwYWdlcyBpbnRvIGEgc3RhYmxlIGNodW5rIHRvIHJlZHVjZSBQV0EgdXBkYXRlIGVycm9yc1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdzcmMvcGFnZXMvYWRtaW4nKSB8fCBpZC5pbmNsdWRlcygnc3JjXFxcXHBhZ2VzXFxcXGFkbWluJykpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdhZG1pbi1jb3JlJztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIFxyXG4gICAgICAgICAgLy8gR3JvdXAgYnJvYWRjYXN0IGNvbXBvbmVudHNcclxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnc3JjL2NvbXBvbmVudHMvYnJvYWRjYXN0JykgfHwgaWQuaW5jbHVkZXMoJ3NyY1xcXFxjb21wb25lbnRzXFxcXGJyb2FkY2FzdCcpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnYnJvYWRjYXN0LWNvbXBvbmVudHMnO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxNTAwLCAvLyBJbmNyZWFzZSBsaW1pdCBmb3IgbGFyZ2VyIGNodW5rc1xyXG4gICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IHRydWUsIC8vIFJlcG9ydCBjb21wcmVzc2VkIHNpemVzXHJcbiAgfSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ08sU0FBUyxvQkFBb0I7QUFDN1AsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sbUJBQW1CO0FBQzFCLFNBQVMsZUFBZTtBQUN4QixPQUFPLFVBQVU7QUFDakIsT0FBTyxRQUFRO0FBTGYsSUFBTSxtQ0FBbUM7QUFpQnpDLElBQU0sYUFBYSxRQUFRLElBQUksZ0JBQWdCO0FBRy9DLElBQUksYUFBYTtBQUNqQixJQUFJLFlBQVksS0FBSyxJQUFJO0FBQ3pCLElBQUk7QUFDRixRQUFNLGNBQWMsS0FBSyxRQUFRLGtDQUFXLHFCQUFxQjtBQUNqRSxNQUFJLEdBQUcsV0FBVyxXQUFXLEdBQUc7QUFDOUIsVUFBTSxjQUFjLEtBQUssTUFBTSxHQUFHLGFBQWEsYUFBYSxPQUFPLENBQUM7QUFDcEUsaUJBQWEsWUFBWSxXQUFXO0FBQ3BDLGdCQUFZLFlBQVksYUFBYSxLQUFLLElBQUk7QUFBQSxFQUNoRDtBQUNGLFNBQVMsT0FBTztBQUNkLFVBQVEsS0FBSyxpREFBaUQsS0FBSztBQUNyRTtBQUdBLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsTUFBTSxNQUFNLE9BQU87QUFBQSxFQUNoRCxRQUFR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
