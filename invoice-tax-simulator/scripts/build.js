// 静的ファイルを dist/ にコピーする(依存なし)。
import { cp, rm, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "src"), { recursive: true });
await cp(join(root, "index.html"), join(dist, "index.html"));
for (const f of ["calc.js", "app.js", "style.css"]) await cp(join(root, "src", f), join(dist, "src", f));
console.log("built -> dist/");
