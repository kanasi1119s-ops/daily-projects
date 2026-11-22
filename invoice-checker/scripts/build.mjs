import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
cpSync(join(root, "src"), dist, { recursive: true });
for (const f of ["index.html", "app.js", "core.js", "style.css"]) {
  if (!existsSync(join(dist, f))) { console.error("missing", f); process.exit(1); }
}
console.log("built ->", dist);
