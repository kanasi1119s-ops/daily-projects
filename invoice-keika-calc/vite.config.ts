import { defineConfig } from "vite";

// 相対パスでビルドし、GitHub Pages などサブパス配信でも動くようにする
export default defineConfig({ base: "./" });
