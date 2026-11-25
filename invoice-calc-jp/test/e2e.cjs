const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  if (!f.startsWith(root) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); s.end(fs.readFileSync(f));
}).listen(0, async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:' + srv.address().port + '/');
  const t = (id) => p.textContent('#' + id);
  const fails = [];
  const eq = (n, a, e) => a !== e && fails.push(`${n}: got ${a} expected ${e}`);
  eq('default gross', await t('o-gross'), '¥110,000');
  await p.check('#wh'); eq('payout wh', await t('o-pay'), '¥99,790');
  await p.selectOption('#mode', 'incl'); await p.fill('#amt', '１１,０００');
  eq('incl net', await t('o-net'), '¥10,000'); eq('incl tax', await t('o-tax'), '¥1,000');
  await p.fill('#amt', 'abc'); eq('err shown', (await t('err1')).length > 0, true);
  eq('stale cleared', await t('o-net'), '-');
  await p.fill('#amt', '100000'); eq('err cleared', await t('err1'), '');
  await p.fill('#date2', '2026-11-25'); await p.fill('#tax2', '1000');
  eq('rate', await t('p-rate'), '50%'); eq('ded', await t('p-ded'), '¥500');
  await p.fill('#date2', ''); eq('empty date err', (await t('err2')).length > 0, true);
  for (const bad of ['100.5','-5','1e3','']) { await p.fill('#amt', bad); eq('bad '+bad, (await t('err1')).length>0, true); }
  await p.fill('#amt', '1,080円'); await p.selectOption('#rate','8'); await p.selectOption('#rnd','round'); eq('8% incl', await t('o-tax'), '¥80');
  await p.setViewportSize({ width: 360, height: 700 });
  eq('no hscroll', await p.evaluate(() => document.documentElement.scrollWidth <= 360), true);
  if (errs.length) fails.push('console: ' + errs.join('|'));
  console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'E2E PASS'); await b.close(); srv.close(); process.exit(fails.length ? 1 : 0);
});
