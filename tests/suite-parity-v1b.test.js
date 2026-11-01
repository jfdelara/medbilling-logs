// Suite parity v1b (Eng CEO rulings M15/M14/M6/M11) for MedBilling Logs. Synthetic data only.
// Run: cd /workspace/pwtest && BASE=http://127.0.0.1:PORT/ node <repo>/tests/suite-parity-v1b.test.js
const { chromium } = require('./helpers/cr-welcome');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const BASE = (process.env.BASE || 'http://127.0.0.1:18998/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', FD = BASE + 'delara-medbilling/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const LABELS = { dPrev: 'Prev', dNext: 'Next', dToday: 'Today', ptSearchBtn: 'Search', gPrev: 'Cell', gNext: 'Cell', gUndo: 'Undo', gRedo: 'Redo', crOpen: 'Resources', cbBtn: 'Call-back', repToday: 'Report', moreBtn: 'More' };
async function boot(browser, vp) {
  const ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: vp }), p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(500);
  return { ctx, p };
}
(async () => {
  // M14: shared files byte-identical across both apps (served copies)
  const get = async u => { try { const r = await fetch(u); return r.ok ? crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex') : null; } catch (e) { return null; } };
  for (const f of ['css/shared/spui.css', 'js/shared/spui.js']) { const a = await get(LOGS + f), b = await get(FD + f); ok(a && a === b, `shared ${f} byte-identical in both apps (${a && a.slice(0, 8)} / ${b && b.slice(0, 8)})`); }
  const browser = await chromium.launch();
  // Fee Desk reference (header colour + chip style)
  const fctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), fp = await fctx.newPage(); await fp.goto(FD); await fp.waitForTimeout(800);
  const fdRef = await fp.evaluate(() => { const h = document.querySelector('header.top') || document.querySelector('header'), c = document.querySelector('.spchip') || document.querySelector('.chip'), cs = c && getComputedStyle(c), hs = getComputedStyle(h), t = h.querySelector('.title');
    return { bg: hs.backgroundColor, tfont: t && getComputedStyle(t).font, chip: cs && { r: cs.borderTopLeftRadius, bw: cs.borderTopWidth, ff: cs.fontFamily } }; });
  await fctx.close();
  for (const vp of [{ width: 360, height: 760 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const w = vp.width, { ctx, p } = await boot(browser, vp);
    // M15 toolbar: icon + short visible label + aria-label, shared .sptb style
    const tb = await p.evaluate(L => Object.keys(L).map(id => { const b = document.getElementById(id); if (!b) return { id, miss: 1 }; if (!b.getClientRects().length) return { id, hidden: 1 }; const l = b.querySelector('.stl'), cs = getComputedStyle(b);
      return { id, sptb: b.classList.contains('sptb'), lbl: l ? l.textContent.trim() : '', lv: !!l && l.getClientRects().length > 0 && getComputedStyle(l).display !== 'none', aria: b.getAttribute('aria-label') || '', br: cs.borderTopLeftRadius }; }), LABELS);
    const bad = tb.filter(t => !t.hidden && (t.miss || !t.sptb || !t.lv || !t.lbl.includes(LABELS[t.id]) || !t.aria));
    ok(bad.length === 0, `${w}: M15 toolbar buttons have shared style, visible short label, aria-label ${JSON.stringify(bad)}`);
    ok(tb.filter(t => !t.hidden).length >= 6 && tb.filter(t => !t.hidden).every(t => t.br === '12px'), `${w}: M15 toolbar radius matches Fee Desk toolbar (12px)`);
    // M11: Logs search button visible 'Search'
    const sb = tb.find(t => t.id === 'ptSearchBtn'); ok(sb && sb.lbl === 'Search' && /Search/.test(sb.aria), `${w}: M11 search button shows 'Search' ${JSON.stringify(sb)}`);
    // M6 header colour + clock font
    const hd = await p.evaluate(() => { const h = document.querySelector('header.top'), t = h.querySelector('.title'), c = h.querySelector('.clock'), tc = getComputedStyle(t), cc = c && getComputedStyle(c);
      return { bg: getComputedStyle(h).backgroundColor, tfont: tc.font, clock: !!c, cw: cc && cc.fontWeight, cs: cc && cc.fontSize, cf: cc && cc.fontFamily, tw: tc.fontWeight, ts: tc.fontSize, tf: tc.fontFamily, cmid: c && Math.abs((c.getBoundingClientRect().top + c.getBoundingClientRect().bottom) - (t.getBoundingClientRect().top + t.getBoundingClientRect().bottom)) / 2 }; });
    ok(hd.bg === fdRef.bg && hd.bg === 'rgb(15, 118, 110)', `${w}: M6 header colour same as Fee Desk (${hd.bg} vs ${fdRef.bg})`);
    ok(hd.clock && hd.cw === hd.tw && hd.cs === hd.ts && hd.cf === hd.tf && hd.cmid <= 4, `${w}: M6 clock in Logs uses header font + placement ${JSON.stringify(hd)}`);
    // M14 chips: premStrip .pi use shared chip
    const ch = await p.evaluate(() => [...document.querySelectorAll('#premStrip .pi, .premstrip .pi')].map(e => { const cs = getComputedStyle(e); return { sp: e.classList.contains('spchip'), r: cs.borderTopLeftRadius, bw: cs.borderTopWidth, ff: cs.fontFamily }; }));
    ok(ch.length > 0 && ch.every(c => c.sp && fdRef.chip && c.bw === fdRef.chip.bw && c.ff === fdRef.chip.ff), `${w}: M14 status chips use the shared chip (${ch.length}) ${JSON.stringify(ch[0])} ref ${JSON.stringify(fdRef.chip)}`);
    // M11 placeholder: shared text, fits
    const ph = await p.evaluate(() => ['eCodeQ', 'eDxQ'].map(id => { const q = document.getElementById(id); return q ? q.placeholder : null; }));
    ok(ph.every(x => x === 'Search codes'), `${w}: M11 code search placeholders 'Search codes' ${JSON.stringify(ph)}`);
    await ctx.close();
  }
  await browser.close(); console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
