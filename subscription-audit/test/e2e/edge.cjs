const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  const reqs = []; p.on('request', r => { if (!r.url().startsWith('http://localhost:8099')&&!r.url().startsWith('blob:')) reqs.push(r.url()); });
  await p.goto('http://localhost:8099/');
  const out = {};
  // corrupted storage
  await p.evaluate(() => localStorage.setItem('subscription-audit:v1', '{broken'));
  await p.reload(); out.corrupt = await p.locator('#rows tr').count();
  // storage with hostile item
  await p.evaluate(() => localStorage.setItem('subscription-audit:v1', JSON.stringify([{name:'<b>x</b>',amount:1e99,cycle:'monthly',billingDate:'2026-01-01',usage:3},{name:'ok',amount:'12',cycle:'yearly',billingDate:'2026-02-30',usage:3},{name:'fine',amount:100,cycle:'monthly',billingDate:'2026-01-01',usage:3,id:'dup'},{name:'fine2',amount:100,cycle:'monthly',billingDate:'2026-01-01',usage:3,id:'dup'}])));
  await p.reload(); out.hostile = await p.locator('#rows tr').count();
  // id null items (id missing) -> edit/delete works?
  await p.locator('#rows tr', { hasText: 'fine2' }).getByText('削除').click();
  out.afterDeleteDup = await p.locator('#rows tr').allTextContents();
  // large / decimal amount, 0 amount
  await p.fill('#f-name', 'free'); await p.fill('#f-amount', '0'); await p.click('#f-submit'); out.zero = await p.locator('#form-error').textContent();
  await p.fill('#f-name', 'dec'); await p.fill('#f-amount', '99.999'); await p.click('#f-submit');
  // empty date
  await p.fill('#f-name', 'nodate'); await p.fill('#f-amount', '5'); await p.fill('#f-date', ''); await p.click('#f-submit'); out.nodate = await p.locator('#form-error').textContent();
  out.reqs = reqs;
  // a11y: labelled inputs, aria
  out.unlabeled = await p.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]),select')].filter(e => !e.closest('label') && !e.labels?.length).map(e => e.id));
  out.csp = await p.evaluate(() => document.querySelector('meta[http-equiv]').content);
  // inline script injection blocked by CSP?
  out.inline = await p.evaluate(() => { try { const s = document.createElement('script'); s.textContent = 'window.__i=1'; document.body.append(s); } catch(e){} return window.__i; });
  console.log(JSON.stringify(out, null, 1), errs);
  await b.close();
})();
