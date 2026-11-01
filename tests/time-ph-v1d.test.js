// Suite parity v1d (Eng CEO ruling): Today grid 'In' time placeholder is '--:--' at ALL widths;
// aria-label keeps 'Time in (HH:MM)'; column width unchanged from ea5e38d (= 3573f2f). Synthetic data only (empty profile).
// Run: cd /workspace/pwtest && BASE=http://127.0.0.1:PORT/ node <repo>/tests/time-ph-v1d.test.js
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18998/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917';
// c-tin column widths measured on 3573f2f, same on ea5e38d (same viewport, default text size)
const W0 = { 360: 46, 390: 46, 1280: 60.03 };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 360, height: 760 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const w = vp.width, ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: vp }), p = await ctx.newPage();
    p.on('dialog', d => d.accept().catch(() => {}));
    await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
    await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const i = document.querySelector('table.grid input[data-c="tin"][placeholder]'); if (!i) return null;
      const cs = getComputedStyle(i), cx = document.createElement('canvas').getContext('2d'); cx.font = cs.font;
      const box = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), col = document.querySelector('table.grid col.c-tin'), td = i.closest('td');
      return { ph: i.placeholder, aria: i.getAttribute('aria-label'), tw: cx.measureText(i.placeholder).width, box, sw: i.scrollWidth, cw: i.clientWidth, colw: col ? parseFloat(getComputedStyle(col).width) : null, tdw: td.getBoundingClientRect().width }; });
    if (!r) { ok(false, `${w}: In placeholder input found`); await ctx.close(); continue; }
    const want = '--:--';
    ok(r.ph === want, `${w}: placeholder is '${want}' (got '${r.ph}')`);
    ok(/Time in \(HH:MM\)/.test(r.aria || ''), `${w}: aria-label has 'Time in (HH:MM)' (${r.aria})`);
    ok(r.sw <= r.cw && r.tw <= r.box + 0.5, `${w}: placeholder fits (text ${r.tw.toFixed(1)} <= box ${r.box.toFixed(1)}, sw ${r.sw} <= cw ${r.cw})`);
    ok(r.colw !== null && Math.abs(r.colw - W0[w]) <= 0.5, `${w}: c-tin column width unchanged (${r.colw} vs ${W0[w]}; td ${r.tdw.toFixed(1)})`);
    await ctx.close();
  }
  await browser.close(); console.log(fails ? `FAILS ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
