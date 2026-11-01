// Suite parity v1 (M16): the source/legal footer (Fee Desk link, manual, ©) is reachable at the bottom of EVERY tab, as in Fee Desk.
// Today: after the last row (scroll the sheet). Synthetic data only. Run: cd /workspace/pwtest && BASE=http://127.0.0.1:PORT/ node <repo>/tests/footer-every-tab-sp.test.js
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18998/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: vp }), p = await ctx.newPage();
    p.on('dialog', d => d.accept().catch(() => {}));
    await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
    await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(500);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#tabs button')].map(b => b.dataset.tab));
    for (const t of tabs) {
      await p.click(`#tabs [data-tab="${t}"]`); await p.waitForTimeout(400);
      const r = await p.evaluate(async () => {
        const f = document.querySelector('footer.foot'); if (!f) return { none: true };
        const g = document.querySelector('#todayList .gwrap'); for (let i = 0; i < 12; i++) { if (g && g.offsetParent) g.scrollTop = g.scrollHeight; window.scrollTo(0, document.documentElement.scrollHeight); await new Promise(r => setTimeout(r, 120)); }
        const c = f.querySelector('.copyright'), R = c.getBoundingClientRect(), bar = document.getElementById('tabs').getBoundingClientRect(), cs = getComputedStyle(f);
        return { shown: cs.display !== 'none' && cs.visibility !== 'hidden' && R.height > 0, inView: R.bottom <= bar.top + 1 && R.top >= 0, link: !!f.querySelector('a[href*="delara-medbilling"]'), man: !!f.querySelector('.manlink') };
      });
      ok(r.shown && r.inView && r.link && r.man, `${vp.width} ${t}: footer (Fee Desk link, manual, ©) reachable above the tab bar ${JSON.stringify(r)}`);
    }
    await ctx.close();
  }
  await browser.close(); console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
