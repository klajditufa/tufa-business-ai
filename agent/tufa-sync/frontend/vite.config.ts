import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_SERVER = "http://127.0.0.1:8765";

// `npm run build` writes the app into the Python package, which serves it.
// `npm run dev` serves it with hot reload and forwards /api to a running `cis-client`
// (started as usual on port 8765), presenting requests as if they came from its own page.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../cis_client/web",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500, // pdfmake and its fonts, loaded only when a PDF is made
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: API_SERVER,
        changeOrigin: true,
        configure: (proxy) => proxy.on("proxyReq", (request) => request.setHeader("origin", API_SERVER)),
      },
    },
  },
});
