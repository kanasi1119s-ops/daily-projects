import { defineConfig } from "vite";
// 相対パスで出力し、サブパス配信(GitHub Pages等)でも動くようにする
export default defineConfig({ base: "./" });
