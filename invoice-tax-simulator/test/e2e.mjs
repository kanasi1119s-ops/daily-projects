// ブラウザE2E(任意実行): PORT=5199 node scripts/serve.js を起動した状態で
//   NODE_PATH=$(npm root -g) node test/e2e.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const url = process.env.URL || "http://localhost:5199/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
let fails = 0;
const check = (name, ok, extra = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " :: " + extra)); if (!ok) fails++; };

await page.goto(url);
const text = () => page.locator("#results").innerText();
const fill = async (id, v) => { await page.fill("#" + id, v); };

let t = await text();
check("初期表示: 3割特例カードあり", t.includes("3割特例"), t);
check("初期表示: 本則 400,000円", t.includes("400,000円"), t);
check("最有利バッジ", (await page.locator(".card.best").count()) === 1);

await page.selectOption("#year", "2026");
t = await text();
check("2026: 2割特例 100,000円", t.includes("2割特例") && t.includes("100,000円"), t);

await fill("sales", "５，５００，０００");
t = await text();
check("全角数字を受理", (await page.locator("#errors").innerText()) === "" && t.includes("2割特例"), t);

await fill("sales", "abc");
check("不正文字でエラー表示", (await page.locator("#errors").innerText()).length > 0);
check("不正文字で結果が消える", (await page.locator(".card").count()) === 0);

await fill("sales", "");
t = await text();
check("空欄は0扱い(エラーなし)", (await page.locator("#errors").innerText()) === "", t);

await fill("sales", "-100");
check("負数はエラー", (await page.locator("#errors").innerText()).length > 0);

await fill("sales", "<img src=x onerror=alert(1)>");
check("XSS文字列は無害", errors.length === 0 && (await page.locator("img").count()) === 0, errors.join("|"));

await fill("sales", "5500000"); await fill("baseSales", "60000000"); await page.selectOption("#year", "2029");
t = await text();
check("5,000万超は簡易課税が要件外バッジ", (await page.locator(".badge.ng").count()) >= 1, t);

check("横スクロールなし(375px)", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await fill("sales", "x");
check("不正入力欄に aria-invalid", (await page.getAttribute("#sales", "aria-invalid")) === "true");
check("JSエラーなし", errors.length === 0, errors.join("|"));
await browser.close();
process.exit(fails ? 1 : 0);
