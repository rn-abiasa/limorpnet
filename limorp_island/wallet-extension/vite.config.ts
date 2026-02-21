import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "path";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      buffer: "buffer",
      stream: "stream-browserify",
      crypto: "crypto-browserify",
    },
  },
  define: {
    "process.env": {},
    global: "globalThis",
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/content-script.ts"),
        inpage: resolve(__dirname, "src/content/inpage.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === "background" ||
            chunkInfo.name === "content" ||
            chunkInfo.name === "inpage"
            ? "[name].js"
            : "assets/[name]-[hash].js";
        },
      },
    },
  },
});
