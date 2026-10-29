import { cpSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("src", "dist", { recursive: true });
for (const f of ["index.html", "app.js", "calc.js", "styles.css"]) {
  if (!existsSync(`dist/${f}`)) throw new Error(`missing ${f}`);
}
const html = readFileSync("dist/index.html", "utf8");
for (const ref of ["styles.css", "app.js"]) if (!html.includes(ref)) throw new Error(`index.html does not reference ${ref}`);
console.log("build ok -> dist/");
