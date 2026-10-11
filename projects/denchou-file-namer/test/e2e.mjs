// 任意のE2E(要 playwright): node test/e2e.mjs dist
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root = path.resolve(process.argv[2]);
const srv = http.createServer((q, s) => { let p = path.join(root, q.url === "/" ? "index.html" : decodeURIComponent(q.url.split("?")[0])); if (!fs.existsSync(p)) { s.writeHead(404); return s.end(); }
  const t = { ".html": "text/html", ".js": "text/javascript" }[path.extname(p)] || "application/octet-stream"; s.writeHead(200, { "content-type": t + "; charset=utf-8" }); s.end(fs.readFileSync(p)); }).listen(0);
const port = srv.address().port;
const b = await chromium.launch();
const pg = await (await b.newContext({ acceptDownloads: true })).newPage();
const errs = []; pg.on("pageerror", (e) => errs.push(String(e))); pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await pg.goto(`http://localhost:${port}/`);
const fail = []; const ck = (c, m) => { if (!c) fail.push(m); console.log(c ? "PASS" : "FAIL", m); };
await pg.setInputFiles("#file", [{ name: "scan1.pdf", mimeType: "application/pdf", buffer: Buffer.from("a") }, { name: "scan2.PDF", mimeType: "application/pdf", buffer: Buffer.from("b") }]);
ck(await pg.locator(".row").count() === 2, "2行表示");
ck(await pg.locator("#dlAll").isDisabled(), "未入力でDL不可");
for (const i of [0, 1]) { const r = pg.locator(".row").nth(i);
  await r.locator('[data-k=date]').fill("R8.10.11"); await r.locator('[data-k=vendor]').fill("株式会社テスト"); await r.locator('[data-k=amount]').fill("¥12,000"); }
const t = await pg.locator(".res").allTextContents(); console.log(t);
ck(t[0].includes("20261011_株式会社テスト_12000_領収書.pdf"), "名前生成");
ck(t[1].includes("_2.pdf"), "重複に連番");
ck(await pg.locator("#dlAll").isEnabled(), "DL可");
const [d] = await Promise.all([pg.waitForEvent("download"), pg.click("#dlCsv")]);
const csv = fs.readFileSync(await d.path(), "utf8"); ck(csv.includes("20261011_株式会社テスト_12000_領収書.pdf") && csv.charCodeAt(0) === 0xfeff, "CSV内容+BOM");
const dls = []; pg.on("download", (x) => dls.push(x.suggestedFilename())); await pg.click("#dlAll"); await pg.waitForTimeout(1200);
ck(dls.length === 2 && dls[0].startsWith("20261011"), "全DL " + dls.join(","));
await pg.selectOption("#order", "vendor-date-amount"); ck((await pg.locator(".res").first().textContent()).includes("株式会社テスト_2026"), "並び順変更");
await pg.locator(".row").first().locator('[data-k=date]').fill("2026-02-30"); ck((await pg.locator(".res").first().textContent()).includes("不正"), "不正日付エラー");
await pg.click("#apply"); await pg.click("#clear"); ck(await pg.locator(".row").count() === 0, "クリア");
ck(errs.length === 0, "console error無し " + errs.join("|"));
await b.close(); srv.close(); process.exit(fail.length ? 1 : 0);
