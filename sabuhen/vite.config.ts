import { defineConfig } from "vite";
import { resolve } from "node:path";

// base を相対パスにして GitHub Pages などのサブパス配信でも動くようにする
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        privacy: resolve(__dirname, "privacy.html"),
      },
    },
  },
  test: { environment: "node" },
});
