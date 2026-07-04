import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Zama's relayer SDK loads WebAssembly and requires:
//   1. COOP/COEP headers → SharedArrayBuffer / threads enabled
//   2. .wasm served with the correct `application/wasm` MIME type
// Vite's built-in server gets (1) via `server.headers` but sometimes serves
// .wasm from node_modules with the wrong MIME (which is what fhe.ts:33 is
// choking on). This tiny middleware forces the right Content-Type header.

const wasmMime = (): Plugin => ({
  name: "wasm-mime",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
      next();
    });
  },
});

const crossOriginHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react(), wasmMime()],
  server: {
    headers: crossOriginHeaders,
  },
  preview: {
    headers: crossOriginHeaders,
  },
  // Keep the relayer SDK out of Vite's dep pre-bundling — the pre-bundle step
  // rewrites the WASM asset URLs in a way that breaks the SDK loader.
  optimizeDeps: {
    exclude: ["@zama-fhe/relayer-sdk"],
  },
});
