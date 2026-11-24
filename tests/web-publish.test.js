// Browser smoke for the assembled published site: landing, /export/, /web/ preview + expiry.
// Run after: python3 scripts/ci/cf-bundle.py --src public --site site --out dist-pages --no-sw-patch
//   cd /workspace/pwtest && URL=http://127.0.0.1:PORT/ node ../tests/web-publish.test.js
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.URL || process.env.BASE || 'http://127.0.0.1:18972/').replace(/\/?$/, '/');
const PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: { width: 1280, height: 900 } });
  const errs = [];
  ctx.on('page', p => p.on('pageerror', e => errs.push(p.url() + ': ' + e.message)));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(p.url() + ': ' + e.message));

  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  const land = await p.evaluate(() => ({ title: document.title, h1: (document.querySelector('h1') || {}).textContent, exportLink: !!document.querySelector('a[href="export/"]'), mail: (document.body.innerText || '').includes('admin@medibrisa.com') }));
  ok(/Get the app/i.test(land.title) && /MedBilling Logs/.test(land.h1 || '') && land.exportLink && land.mail, 'GET / is the landing page ' + JSON.stringify(land));

  const priv = await p.goto(BASE + 'privacy.html', { waitUntil: 'domcontentloaded' });
  ok(priv.ok() && await p.locator('h1').textContent().then(t => /Privacy/.test(t)), 'GET /privacy.html');

  await p.goto(BASE + 'export/', { waitUntil: 'domcontentloaded' });
  ok(await p.locator('#setupForm, #unlockForm, h1').first().count() > 0, 'GET /export/ still loads the legacy web app');

  const css = await p.request.get(BASE + 'web/css/app.css');
  const js = await p.request.get(BASE + 'web/js/app.js');
  const ico = await p.request.get(BASE + 'web/icons/icon-192.png');
  const wpjs = await p.request.get(BASE + 'web/js/web-preview.js');
  const wpcss = await p.request.get(BASE + 'web/css/web-preview.css');
  ok(css.ok() && js.ok() && ico.ok() && wpjs.ok() && wpcss.ok(), ' /web/ assets (css, js, favicon, preview) return 200');

  await p.goto(BASE + 'web/', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#setupForm:not([hidden]), #wpBanner, #lock');
  const pre = await p.evaluate(() => ({
    banner: !!(document.getElementById('wpBanner') && document.getElementById('wpBanner').offsetHeight),
    expired: !!document.getElementById('wpExpired'),
    setup: !!(document.getElementById('setupForm') && !document.getElementById('setupForm').hidden),
    fd: [...document.querySelectorAll('a[href*="feedesk"]')].map(a => a.href),
    html: document.documentElement.className
  }));
  ok(pre.banner && !pre.expired && pre.setup, 'pre-expiry: banner + setup, no expired card ' + JSON.stringify({ banner: pre.banner, expired: pre.expired, setup: pre.setup, html: pre.html }));
  ok(pre.fd.length && pre.fd.every(h => /feedesk\.medibrisa\.com\/web\//.test(h)), 'Fee Desk links point at feedesk.medibrisa.com/web/ ' + JSON.stringify(pre.fd.slice(0, 4)));

  await p.check('input[name=sKind][value=pin]');
  await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN);
  await p.check('#sAck'); await p.check('#sResp');
  await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), { timeout: 15000 });
  await p.waitForTimeout(400);
  const name = p.locator('#todayList tbody tr.blank .gc[data-c="name"]').first();
  await name.click({ position: { x: 8, y: 8 } });
  try {
    const typeBtn = p.locator('.scanmenu [data-m="type"]');
    if (await typeBtn.count() && await typeBtn.first().isVisible()) await typeBtn.first().click();
  } catch (e) { /* no scan menu */ }
  await name.fill('Alex Rivera');
  await name.press('Tab');
  await p.waitForTimeout(500);
  const typed = await p.evaluate(() => {
    const c = document.querySelector('#todayList tbody tr .gc[data-c="name"]');
    return c && c.value;
  });
  ok(/Alex/.test(typed || ''), 'pre-expiry: can create a log row by typing a name (' + typed + ')');

  await p.goto(BASE + 'web/?wp_now=2027-05-25T12:00:00-06:00', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#wpExpired, #unlockForm');
  const post = await p.evaluate(() => ({
    expired: !!(document.getElementById('wpExpired') && document.getElementById('wpExpired').offsetHeight),
    title: (document.querySelector('#wpExpired h2') || {}).textContent,
    exportBtn: !!(document.getElementById('wpExport') && document.getElementById('wpExport').offsetHeight),
    apps: !!document.querySelector('#wpExpired a[href="https://medibrisa.com/#apps"]'),
    mail: !!document.querySelector('#wpExpired a[href="mailto:admin@medibrisa.com"]'),
    setupShown: !!(document.getElementById('setupForm') && !document.getElementById('setupForm').hidden && document.getElementById('setupForm').offsetParent),
    html: document.documentElement.classList.contains('wp-expired'),
    body: document.body.innerText
  }));
  ok(post.expired && post.html && post.exportBtn && post.apps && post.mail, 'post-expiry: Medibrisa expired notice with export + apps + admin mail ' + JSON.stringify({ expired: post.expired, exportBtn: post.exportBtn, apps: post.apps, mail: post.mail, title: post.title }));
  ok(!post.setupShown, 'post-expiry: new-passcode setup is hidden');
  ok(!/Jose|jfdelara|780-\d|T6G /i.test(post.title + post.body.slice(0, 800)), 'expired notice has no personal name, address or phone');

  await p.waitForSelector('#unlockForm:not([hidden])');
  await p.fill('#uPass', PIN);
  await p.click('#uBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked'), { timeout: 15000 });
  await p.waitForTimeout(400);
  const frozen = await p.evaluate(() => window.MBWebPreview && window.MBWebPreview.frozen());
  ok(frozen, 'after unlock on simulated May 25 2027, preview is frozen');
  const name2 = p.locator('#todayList tbody tr .gc[data-c="name"]').first();
  const before = await name2.inputValue().catch(() => '');
  await name2.click({ position: { x: 8, y: 8 } }).catch(() => {});
  await name2.fill('ShouldNotSave').catch(() => {});
  await name2.press('Tab').catch(() => {});
  await p.waitForTimeout(400);
  const after = await name2.inputValue().catch(() => '');
  ok(after !== 'ShouldNotSave', 'post-expiry: typing does not keep a new name in the cell (' + after + ')');
  ok(await p.locator('#wpExport').isVisible(), 'export button still visible after unlock');
  const expAll = await p.locator('#expAll').count();
  ok(expAll > 0, 'Settings encrypted-backup Export control is still in the page for local data');

  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await browser.close();
  console.log(fails ? 'FAILS ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
