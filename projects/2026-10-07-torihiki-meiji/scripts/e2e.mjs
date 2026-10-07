// 任意: ブラウザE2E(playwright が解決できる環境でのみ実行)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = 5199;
const srv = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: port }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const fails = [];
const check = (name, cond) => { if (!cond) fails.push(name); console.log(cond ? 'PASS' : 'FAIL', name); };

await page.goto(`http://localhost:${port}/`);
check('初期: コピー無効', await page.locator('#copy').isDisabled());
check('初期: エラー表示あり', (await page.locator('#errors li').count()) === 8);
await page.fill('#clientName', '株式会社テスト');
await page.fill('#freelancerName', '山田太郎');
await page.fill('#orderDate', '2026-10-01');
await page.fill('#workDescription', 'LP制作');
await page.fill('#deliveryDate', '2026-10-01');
await page.fill('#deliveryPlace', 'オンライン');
await page.fill('#amount', '150000');
await page.fill('#paymentDate', '2026-12-31');
check('60日超過の警告', (await page.locator('#warnings li').count()) === 1);
check('エラー0でコピー有効', await page.locator('#copy').isEnabled());
await page.fill('#paymentDate', '2026-11-29');
check('警告解消', (await page.locator('#warnings li').count()) === 0);
check('プレビューに金額', (await page.locator('#preview').textContent()).includes('150,000円'));
await page.check('#inspect');
check('検査日欄が表示', await page.locator('#inspectionRow').isVisible());
check('検査日未入力でエラー', await page.locator('#copy').isDisabled());
await page.check('#amountUndecided');
check('未定: 算定方法欄表示', await page.locator('#amountMethodRow').isVisible());
await page.click('#reset');
check('リセットで初期化', (await page.locator('#errors li').count()) === 8);
console.log(errs, await page.locator('#errors li').count());
check('JSエラーなし', errs.length === 0);
await browser.close(); srv.kill();
if (fails.length) { console.log('FAILED:', fails); process.exit(1); }
