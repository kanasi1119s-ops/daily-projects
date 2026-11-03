// 静的ファイルを dist/ にコピーするだけのビルド
import { cp, rm, mkdir } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const f of ["index.html", "style.css", "src"]) await cp(f, `dist/${f}`, { recursive: true });
console.log("built -> dist/");
