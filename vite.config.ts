import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/monaco|codemirror/.test(id)) return 'editor'
            if (/echarts|chart\.js|d3/.test(id)) return 'charts'
            if (/xlsx|sheetjs/.test(id)) return 'spreadsheets'
            if (/pdfjs-dist/.test(id)) return 'pdf'
            if (/three/.test(id)) return 'three'
            // default vendor split per top-level package
            const m = id.split('node_modules/')[1].split('/')[0].replace('@', '')
            return `vendor-${m}`
          }
        },
      },
    },
  }
}));
