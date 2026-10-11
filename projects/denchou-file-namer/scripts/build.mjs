import { cpSync, rmSync, mkdirSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
for (const f of ["index.html", "src", "privacy.html"]) cpSync(f, `dist/${f}`, { recursive: true });
console.log("built -> dist/");
