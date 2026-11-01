// v9q: full-width web app on computers. App bar, time strip, tabs, toolbar and the Today grid span the window (14 px sides);
// every column (through Billing notes and ⋯) is on screen with no sideways scrolling from 1280 px, with Windows-style 17 px
// scrollbars; extra width goes to the text columns (In / Out / Min / Units / H/C and MRN stay compact); codes never break
// mid-code; the grid fills to the bottom; sticky header and column alignment intact; prose keeps a readable width;
// iPhone / iPad layouts identical to v9p (baseline metrics from v9p: /workspace/artifacts/mbl-v9q/probe-before/metrics.json).
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18792/medbilling-logs/ OUT=/workspace/artifacts/mbl-v9q node /workspace/medbilling-logs/tests/wide-v9q.test.js
const path = require('path'), fs = require('fs');
const { chromium } = require('./helpers/cr-welcome');
const URL0 = process.env.URL || 'http://127.0.0.1:18792/medbilling-logs/';
const OUT = process.env.OUT || '/workspace/artifacts/mbl-v9q'; fs.mkdirSync(OUT, { recursive: true });
const BASEF = process.env.BASELINE || '/workspace/artifacts/mbl-v9q/probe-before/metrics.json';
const PIN = '48203917', DAY = '2026-10-06';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errors = [];
async function seed(p) {
  await p.evaluate(async DAY => { const now = new Date(`${DAY}T15:00:00`).getTime(), H = 3600000, C = c => ({ c, k: c, d: '', j: 'AB', f: '' });   // a fixed past day (works at any hour)
    const rows = [
      ['Thompson-Wakefield, Margaret Anne', '123456789', ['03.03A', '13.99BA'], 'CMGP', 'CMXV20, TEV', 'V22.2', 'Seen in L&D triage, reassessed after NST', '88001', 'Royal Alexandra Hospital', 'OBST'],
      ['Nguyen, Linh', '987654321', ['03.04A'], '', '', '650', '', '88002', '', 'D/N'],
      ['Okonkwo, Chukwuemeka', '555123987', ['87.98A', '03.03A'], 'BMIPRO', 'TEV', '642.4, V22.2', 'Call-back from home; PPH watch', '88001', 'Royal Alexandra Hospital', 'OBST'],
      ['Smith, Jo', '', ['03.01AA'], '', '', '', '', '', '', ''],
      ['Lefebvre-Desrochers, Marie-Claude', '445566778', ['03.08A', '13.99BA', '03.03A'], 'CMXC30', 'CMGP, TEV', '661.1, V22.2', 'Long consult; interpreter used', '88003', 'Grey Nuns Community Hospital', 'MED']];
    let i = 0;
    for (const r of rows) { const s = now - (6 - i) * H, e = s + 40 * 60000; i++;
      const codes = r[2].map(C); r[5].split(/,\s*/).filter(Boolean).forEach((d, j) => { if (codes[j]) codes[j].dx = d; });
      await Vault.save({ id: 'w' + i, kind: 'enc', name: r[0], mrn: r[1], chart: '', label: '', initials: '', billingNote: r[6], setting: 'H', facility: null, type: '', codes, mod1: r[3], mod2: r[4], facNo: r[7], facNm: r[8], fcen: r[9] || undefined, notes: [], segs: [{ s, e }], status: 'done', photos: [], links: [], created: s, at: s }); }
  }, DAY);
}
async function open(br, vp, o, withData, label) {
  const ctx = await br.newContext(Object.assign({ viewport: vp, timezoneId: 'America/Edmonton' }, o || {})), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(label + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/^Refused to apply a stylesheet/.test(m.text())) errors.push(label + ': ' + m.text()); });
  // desktop runs use Chromium's classic (non-overlay) scrollbars (--hide-scrollbars removed): 17 px, like Windows 11 Edge
  await p.goto(URL0); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(300); await p.evaluate(() => { const c = document.querySelector('#refCol'); if (c && c.checked) c.click(); }); await p.waitForTimeout(400);   // v9s: this suite checks the layout with Referring provider turned off (entry-window-v9r covers it on)
  if (withData) { await seed(p); await p.click('#lockNow'); await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn'); await p.waitForFunction(() => !document.body.classList.contains('locked')); }
  if (withData) await p.evaluate(k => { const i = document.querySelector('#dPick'); i.value = k; i.dispatchEvent(new Event('change')); }, DAY);
  await p.waitForTimeout(900);
  await p.evaluate(() => { document.querySelectorAll('#toast, .toast, #snack').forEach(t => { t.style.visibility = 'hidden'; }); });
  return { ctx, p };
}
const M = p => p.evaluate(() => { const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
  const w = document.querySelector('#todayList .gwrap'), t = w.querySelector('table'), wr = w.getBoundingClientRect();
  const cols = {}; [...t.querySelectorAll('colgroup col')].forEach(c => { cols[c.className.replace(/^c-/, '')] = Math.round(c.getBoundingClientRect().width); });
  const ths = [...t.tHead.rows[0].cells], th = ths.map(c => Math.round(c.getBoundingClientRect().left)), td = [...t.tBodies[0].rows[0].cells].map(c => Math.round(c.getBoundingClientRect().left));
  const broken = [...t.querySelectorAll('tbody textarea.gc')].filter(a => a.value && a.scrollWidth > a.clientWidth + 1).map(a => a.dataset.c + ':' + a.value);
  const ft = document.querySelector('footer.foot');
  return { vw: innerWidth, vh: innerHeight, sbw: w.offsetWidth - w.clientWidth, docSW: document.documentElement.scrollWidth, main: R(document.querySelector('main')), top: R(document.querySelector('.top')), pbar: R(document.querySelector('.pbar')), tabs: R(document.querySelector('.tabs')), tab1: R(document.querySelector('#tabs button')), tool: R(document.querySelector('#todayTools, .dbar, .today-tools') || document.querySelector('#dPick')), gwrap: R(w), sw: w.scrollWidth, cw: w.clientWidth, cols,
    lastTh: Math.round(ths[ths.length - 1].getBoundingClientRect().right), wrRight: Math.round(wr.left + w.clientLeft + w.clientWidth), align: JSON.stringify(th) === JSON.stringify(td), broken, footTop: ft ? Math.round(ft.getBoundingClientRect().top) : 1e9 }; });
(async () => {
  const cr = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const base = fs.existsSync(BASEF) ? JSON.parse(fs.readFileSync(BASEF, 'utf8')) : null;
  const res = {};
  for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900], [1920, 969], [1920, 1080], [2560, 1440]]) {
    const L = `${w}x${h}`;
    for (const withData of [false, true]) {
      const { ctx, p } = await open(cr, { width: w, height: h }, null, withData, L); const m = await M(p); const D = withData ? 'with data' : 'empty day';
      if (withData) res[L] = m;
      if (!withData) { ok(m.top[0] === 0 && m.top[2] >= w - 1 && m.pbar[2] >= w - 1 && m.main[0] <= 1 && m.main[2] >= w - 1 && (m.tabs[1] > h / 2 ? m.tabs[0] <= 1 && m.tabs[2] >= w - 1 : m.tab1[0] <= 16) && m.gwrap[0] <= 16 && m.gwrap[2] >= w - 16, `${L}: app bar, time strip, tabs and grid span the window (tab at ${m.tab1[0]}px, grid ${m.gwrap[0]}–${m.gwrap[2]} of ${w})`); }
      ok(m.sbw >= 15 && m.sw <= m.cw + 1 && m.docSW <= w && m.lastTh <= m.wrRight + 1, `${L} ${D}: all ${Object.keys(m.cols).length} columns on screen, no sideways scroll (grid ${m.sw}/${m.cw}px, last column ends ${m.lastTh} ≤ ${m.wrRight}; scrollbar ${m.sbw}px)`);
      ok(m.align, `${L} ${D}: header cells line up with the cells below`);
      if (withData) ok(!m.broken.length, `${L}: no code / name broken mid-word ${m.broken.join(' | ')}`);
      ok(m.gwrap[3] >= (m.tabs[1] > h / 2 ? m.tabs[1] : h) - 8 && m.footTop >= (m.tabs[1] > h / 2 ? m.tabs[1] : h) - 1,   /* suite parity (footer may sit under the fixed bar): grid fills to the bottom tab bar */ `${L} ${D}: grid fills to the bottom (ends ${m.gwrap[3]} of ${h}); footer only after the last row (footer top ${m.footTop})`);
      if (withData) {
        await p.evaluate(() => { const w = document.querySelector('#todayList .gwrap'); w.scrollTop = 260; }); await p.waitForTimeout(250);
        const st = await p.evaluate(() => { const w = document.querySelector('#todayList .gwrap'), th = w.querySelector('thead th.h-name'); return [Math.round(th.getBoundingClientRect().top), Math.round(w.getBoundingClientRect().top + w.clientTop), w.scrollTop]; });
        ok(st[2] > 0 && Math.abs(st[0] - st[1]) <= 1, `${L}: sticky header stays at the top of the grid while scrolled (header ${st[0]}, grid ${st[1]}, scrolled ${st[2]})`);
        await p.evaluate(() => { document.querySelector('#todayList .gwrap').scrollTop = 0; }); await p.waitForTimeout(200);
        await p.screenshot({ path: path.join(OUT, `wide-today-${L}.png`) });
        if (w === 1920 && h === 969 || w === 2560) for (const tb of ['history', 'res', 'data']) { const b = await p.$(`#tabs [data-tab="${tb}"]`); if (!b) continue; await b.click(); await p.waitForTimeout(600);
          const pr = await p.evaluate(tb => { const ps = [...document.querySelectorAll(`#tab-${tb} p, #tab-${tb} li`)].filter(e => e.offsetParent && (e.textContent || '').length > 120); return { n: ps.length, max: Math.max(0, ...ps.map(e => Math.round(e.getBoundingClientRect().width))) }; }, tb);
          ok(pr.max <= 920, `${L} ${tb}: prose keeps a readable width (widest long paragraph ${pr.max}px, ${pr.n} checked)`);
          await p.screenshot({ path: path.join(OUT, `wide-${tb}-${L}.png`) }); }
        if (w === 1920 && h === 969) { await p.click('#tabs [data-tab="today"]'); await p.waitForTimeout(300); }
      }
      await ctx.close();
    }
  }
  // column sharing: numbers compact and identical everywhere; text columns grow with the window
  const s1 = res['1366x768'].cols, s4 = res['2560x1440'].cols, s2 = res['1920x1080'].cols;
  const nums = ['rn', 'hc', 'tin', 'tout', 'min', 'u'];
  ok(Object.values(res).every(m => nums.every(k => m.cols[k] === s1[k])) && Object.values(res).every(m => m.cols.mrn <= 100), `numeric columns stay compact at every size (${nums.map(k => k + ' ' + s1[k]).join(', ')}; MRN ${Object.values(res).map(m => m.cols.mrn).join('/')})`);
  ok(['name', 'fno', 'fee', 'mod1', 'dx', 'note'].every(k => s4[k] > s2[k] && s2[k] > s1[k]), `text columns grow with the window (1366 → 1920 → 2560: ${['name', 'fee', 'dx', 'note'].map(k => `${k} ${s1[k]}→${s2[k]}→${s4[k]}`).join(', ')})`);
  // iPhone / iPad unchanged vs v9p
  if (!base) ok(false, 'baseline metrics missing: ' + BASEF);
  else for (const [vp, w, h, ua, dsf] of [['402x874m', 402, 874, IPHONE, 3], ['375x667m', 375, 667, IPHONE, 3], ['820x1180t', 820, 1180, IPAD, 2]]) {
    const { ctx, p } = await open(cr, { width: w, height: h }, { userAgent: ua, isMobile: true, hasTouch: true, deviceScaleFactor: dsf }, true, vp); const m = await M(p), b = base[vp];
    // v9x: the one-line H-Link batch strip above the sheet and the new Claim column are the only changes; compare the rest
    const strip = await p.evaluate(() => { const x = document.querySelector('#clmBar'); if (!x || x.hidden) return 0; const cs = getComputedStyle(x); return Math.round(x.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom)); });
    ok(strip > 0 && strip <= 30, `${vp}: v9x batch strip is one line on this screen (${strip}px)`);
    if (m.cols.clm != null) { m.sw -= m.cols.clm; delete m.cols.clm; } if (Array.isArray(m.gwrap)) m.gwrap[1] -= strip;
    // b11: the new Sex column is the only tablet change (same treatment as the v9x Claim column); on phones (≤ 480 px) the b11
    // phone-fit sheet (the owner, 2026-10-19: half-size rows, content-sized columns) replaces the v9p layout, so check that instead
    if (m.cols.sex != null) { m.sw -= m.cols.sex; delete m.cols.sex; }
    // spec: public/js/app.js:34-38 (phone ≤ 480 px → html.phonefit, --g-h = max(20, round(40 × 0.5)) = 20 px); table narrower than v9p
    if (w <= 480) {
      const pf = await p.evaluate(() => [document.documentElement.classList.contains('phonefit'), getComputedStyle(document.documentElement).getPropertyValue('--g-h').trim()]);
      ok(pf[0] && pf[1] === '20px' && m.sw < b.sw, `${vp}: b11 phone-fit sheet replaces the v9p layout (rows ${pf[1]}, table ${m.sw}px < v9p ${b.sw}px)`);
      await ctx.close(); continue;
    }
    // v9x: ±1 px (sub-pixel), and the first tab button is narrower because there is a new Claims tab (its left / top / bottom stay)
    const near = (x, y) => JSON.stringify(Object.keys(Object(x)).sort()) === JSON.stringify(Object.keys(Object(y)).sort()) && Object.keys(Object(x)).every(k => Math.abs(x[k] - y[k]) <= 1);
    const bb = m.tabs && m.tabs[1] > m.vh / 2;   // suite parity: the tab row moved to the fixed bottom bar, so only the columns, table width and grid sides must match v9p
    const same = near(m.cols, b.cols) && (bb ? near([m.gwrap[0], m.gwrap[2]], [b.gwrap[0], b.gwrap[2]]) : near(m.gwrap, b.gwrap) && near(m.main, b.main) && near([m.tab1[0], m.tab1[1], m.tab1[3]], [b.tabsBtn1[0], b.tabsBtn1[1], b.tabsBtn1[3]])) && Math.abs(m.sw - b.sw) <= 2;
    ok(same, `${vp}: layout identical to v9p (grid ${m.gwrap}, table ${m.sw}px, columns unchanged)` + (same ? '' : ` now ${JSON.stringify([m.cols, m.gwrap, m.main, m.tab1, m.sw])} was ${JSON.stringify([b.cols, b.gwrap, b.main, b.tabsBtn1, b.sw])}`));
    await p.screenshot({ path: path.join(OUT, `wide-check-${vp.replace(/[mt]$/, '')}.png`) }); await ctx.close();
  }
  await cr.close();
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); console.error("page errors:", errors.join("\n")); process.exit(2); });
