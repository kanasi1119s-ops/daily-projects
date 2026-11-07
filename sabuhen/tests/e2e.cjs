// 任意実行のE2E: npm run build && npx vite preview --port 4173 & node tests/e2e.cjs
// Playwright がグローバルに入っている環境向け(プロジェクトの依存には含めていません)
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  const base = process.env.BASE_URL || "http://localhost:4173/";
  await page.goto(base);

  // 1. 空状態
  assert.equal(await page.locator("#empty").isVisible(), true);

  // 2. バリデーションエラー
  await page.click("#submit-btn");
  assert.match(await page.textContent("#form-errors"), /サービス名/);

  // 3. 追加(XSS文字列を含む)
  await page.fill("[name=name]", "<img src=x onerror=window.__xss=1>");
  await page.fill("[name=price]", "1,980");
  await page.fill("[name=usesPerMonth]", "0");
  await page.click("#submit-btn");
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.match(await page.textContent("#tbody"), /解約候補/);
  assert.match(await page.textContent("#summary"), /1,980円/);

  // 4. 永続化(リロード後も残る)
  await page.reload();
  assert.match(await page.textContent("#tbody"), /onerror/);

  // 5. 編集
  await page.click("td button:text('編集')");
  await page.fill("[name=price]", "600");
  await page.fill("[name=usesPerMonth]", "20");
  await page.click("#submit-btn");
  assert.match(await page.textContent("#tbody"), /継続でOK/);
  assert.equal(await page.locator("#tbody tr").count(), 1);

  // 6. サンプル+解約試算
  await page.click("#sample-btn");
  const rows = await page.locator("#tbody tr").count();
  assert.equal(rows, 7);
  await page.locator("#tbody tr input[type=checkbox]").first().check();
  assert.match(await page.textContent("#sim"), /1件を解約した場合/);

  // 7. CSV 書き出し→全削除→読み込み
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#export-btn")]);
  const path = await dl.path();
  const csv = fs.readFileSync(path, "utf8");
  assert.match(csv, /name,price,cycle/);
  await page.click("#clear-btn");
  assert.equal(await page.locator("#tbody tr").count(), 0);
  await page.setInputFiles("#import-file", path);
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7);

  // 8. 不正CSV
  fs.writeFileSync("/tmp/bad.csv", "name,price,cycle\nX,abc,monthly\n");
  await page.setInputFiles("#import-file", "/tmp/bad.csv");
  await page.waitForFunction(() => /取り込めなかった行/.test(document.getElementById("data-msg").textContent));

  // 9. 横スクロール(ページ全体)が出ない
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, "page-level horizontal overflow on mobile");

  // 10. privacy ページ
  const r = await page.goto(base + "privacy.html");
  assert.equal(r.status(), 200);

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("E2E OK");
})().catch((e) => { console.error(e); process.exit(1); });
