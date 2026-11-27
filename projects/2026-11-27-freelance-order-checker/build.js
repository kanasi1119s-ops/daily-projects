// 静的サイトのためビルドは dist/ へのコピーのみ。
import fs from "node:fs";
fs.rmSync("dist", { recursive: true, force: true }); fs.mkdirSync("dist/lib", { recursive: true });
for (const f of ["index.html", "app.js", "lib/logic.js"]) fs.copyFileSync(f, "dist/" + f);
console.log("built dist/");
