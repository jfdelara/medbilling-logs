// v9u: compact boxes, ⇔ Wider (one row per billing line), editable service date. v9t (built on the v9r test setup): the entry window (tap / click a row number → every field of the row in one window; full-screen sheet on phones),
// ▾ choices on every field (recent, favourites, code searches, lists) with typing still allowed, Save / Cancel / Previous / Next,
// a new entry from an empty row, and the Referring provider column (Settings, off by default) in the grid and the window.
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18792/medbilling-logs/ OUT=/workspace/artifacts/mbl-popup node /workspace/medbilling-logs/tests/entry-window-v9r.test.js
const path = require('path'), fs = require('fs');
const { chromium, webkit } = require('./helpers/cr-welcome');
const URL0 = process.env.URL || 'http://127.0.0.1:18792/medbilling-logs/';
const OUT = process.env.OUT || '/workspace/artifacts/mbl-popup'; fs.mkdirSync(OUT, { recursive: true });
const PIN = '48203917', DAY = '2026-10-06';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errors = [];
async function seed(p) {
  await p.evaluate(async DAY => { const now = new Date(`${DAY}T15:00:00`).getTime(), H = 3600000, C = c => ({ c, k: c, d: '', j: 'AB', f: '' });
    const rows = [['Thompson-Wakefield, Margaret Anne', '123456789', ['03.03A'], 'CMGP', '', 'V22.2', 'Seen in L&D triage', '88001', 'OBST'],
      ['Nguyen, Linh', '987654321', ['03.04A'], '', '', '650', '', '88002', 'D/N'],
      ['Okonkwo, Chukwuemeka', '555123987', ['87.98A'], 'BMIPRO', 'TEV', '642.4', 'PPH watch', '88001', 'OBST']];
    let i = 0;
    for (const r of rows) { const s = now - (6 - i) * H, e = s + 40 * 60000; i++; const codes = r[2].map(C); codes[0].dx = r[5];
      await Vault.save({ id: 'w' + i, kind: 'enc', name: r[0], mrn: r[1], chart: '', label: '', initials: '', billingNote: r[6], setting: 'H', facility: null, type: '', codes, mod1: r[3] || undefined, mod2: r[4] || undefined, facNo: r[7], fcen: r[8], notes: [], segs: [{ s, e }], status: 'done', photos: [], links: [], created: s, at: s, updated: Date.now() }); }
  }, DAY);
}
async function open(br, o, label) {
  const ctx = await br.newContext(Object.assign({ timezoneId: 'America/Edmonton' }, o)), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(label + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/^Refused to apply a stylesheet/.test(m.text())) errors.push(label + ': ' + m.text()); });
  await p.goto(URL0); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(300);
  await seed(p); await p.click('#lockNow'); await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn'); await p.waitForFunction(() => !document.body.classList.contains('locked'));
  await p.evaluate(k => { const i = document.querySelector('#dPick'); i.value = k; i.dispatchEvent(new Event('change')); }, DAY);
  await p.waitForTimeout(900);
  await p.evaluate(() => { document.querySelectorAll('#toast, .toast, #snack').forEach(t => { t.style.visibility = 'hidden'; }); });
  return { ctx, p };
}
const cell = (p, row, c) => p.evaluate(([row, c]) => { const tr = document.querySelectorAll('#todayList table.grid tbody tr')[row], el = tr && tr.querySelector(`.gc[data-c="${c}"]`); return el ? (el.value != null && el.tagName !== 'DIV' ? el.value : el.dataset.v || el.textContent) : null; }, [row, c]);
const rowOf = (p, nm) => p.evaluate(nm => [...document.querySelectorAll('#todayList table.grid tbody tr')].findIndex(tr => { const c = tr.querySelector('.gc[data-c="name"]'); return c && c.value === nm; }), nm);
const ewv = (p, k) => p.$eval('#ew_' + k, el => el.value);
const tapRn = async (p, row, touch) => { const rs = `#todayList table.grid tbody tr:nth-child(${row + 1}) `; if (touch) await p.tap(rs + 'th.rn'); else { await p.hover(rs + 'td.c-name'); await p.click(rs + '.rew'); } await p.waitForSelector('#ewDlg[open]'); await p.waitForTimeout(250); };

const fillL = async (p, i, code, dx, mods) => { await p.fill(`#ew_s${i}_code`, code); await p.keyboard.press('Escape'); await p.fill(`#ew_s${i}_dx`, dx); await p.keyboard.press('Escape');
  for (let j = 0; j < mods.length; j++) { if (!(await p.$(`#ew_s${i}_m${j}`))) await p.click(`[data-addm="${i}"]`); await p.fill(`#ew_s${i}_m${j}`, mods[j][0]); await p.keyboard.press('Escape'); await p.fill(`#ew_s${i}_u${j}`, mods[j][1] || ''); } };
const txt = (p, s) => p.$eval(s, el => el.textContent.trim());
(async () => {
  const cr = await chromium.launch(), wk = await webkit.launch();
  const runs = [];
  if (!process.env.ONLY_P) runs.push(['desktop 1280x800', cr, { viewport: { width: 1280, height: 800 } }, 0], ['desktop 1920x1080', cr, { viewport: { width: 1920, height: 1080 } }, 0]);
  if (!process.env.ONLY_D) runs.push(['phone 390x844', wk, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IPHONE }, 1]);
  for (const [L, br, o, touch] of runs) {
    const { ctx, p } = await open(br, o, L), tag = L.replace(/ /g, '-');
    ok(!!(await p.$('#todayList th.h-ref')), `${L}: referring provider column on by default`);
    const r0 = await rowOf(p, 'Thompson-Wakefield, Margaret Anne'); await tapRn(p, r0, touch);
    ok(await ewv(p, 'name') === 'Thompson-Wakefield, Margaret Anne' && await ewv(p, 's0_code') === '03.03A' && await ewv(p, 's0_dx') === 'V22.2' && await ewv(p, 's0_m0') === 'CMGP' && await ewv(p, 'fno') === '88001' && await ewv(p, 'fcen') === 'OBST', `${L}: existing entry loads into Billing line 1 (old data compatible)`);
    ok(!!(await p.$('#ew_refNm')) && !!(await p.$('#ew_prov')) && !!(await p.$('#ew_skill')) && !!(await p.$('#ew_ba')) && !!(await p.$('#ew_admit')) && !!(await p.$('#ew_intercept')) && !!(await p.$('#ew_goodFaith')), `${L}: claim and visit detail fields present`);
    ok(/Billing line 1/.test(await txt(p, '.ewline .ewlh b')) && !!(await p.$('#ewAddLine')), `${L}: "Billing line 1" and "+ Add billing line"`);
    await p.waitForFunction(() => /\$/.test(document.querySelector('#ewTotal').textContent), null, { timeout: 8000 }).catch(() => {});
    // the example codes (fake patient): 03.03BZ + CMXV35, 87.54A, 03.01AA + TEV ×04
    await p.selectOption('#ew_sex', 'F'); await p.fill('#ew_skill', 'OBGY'); await p.keyboard.press('Escape');
    await fillL(p, 0, '03.03BZ', '650', [['CMXV35', '']]);
    await p.click('#ewAddLine'); await fillL(p, 1, '87.54A', '650', []);
    await p.click('#ewAddLine'); await fillL(p, 2, '03.01AA', '650', [['TEV', '04']]);
    await p.fill('#ew_refNm', 'Test Referrer'); await p.fill('#ew_refId', '12345'); await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const pays = [await txt(p, '#ew_s0_pay'), await txt(p, '#ew_s1_pay'), await txt(p, '#ew_s2_pay')], tot = await txt(p, '#ewTotal');
    ok(pays.join() === '$70.58,$16.24,$91.64' && tot === '$178.46', `${L}: expected payments ${pays.join(' ')} total ${tot}`);
    const n4 = await p.$$eval('.ewline', l => l.length); await p.click('#ewAddLine'); await p.click('#ewAddLine');
    ok(await p.$$eval('.ewline', l => l.length) === n4 + 2, `${L}: add billing line has no limit`);
    await p.click('[data-dline="4"]'); await p.click('[data-dline="3"]'); ok(await p.$$eval('.ewline', l => l.length) === 3, `${L}: remove billing line`);
    await p.click('[data-dd="s0_m0"]'); await p.waitForSelector('#ewMenu:not([hidden]) .ewo'); const secs = await p.$$eval('#ewMenu .ewsec', l => l.map(x => x.textContent));
    ok(secs.some(s => /Listed for 03.03BZ/.test(s)), `${L}: modifier ▾ lists the code's modifiers (${secs.join(' | ')})`);
    await p.keyboard.press('Escape'); await p.click('#ewLines .ewlh b');
    const chk = await p.$$eval('#ewChecks li', l => l.map(x => x.textContent)); ok(chk.length >= 1, `${L}: checks box: ${chk.join(' / ')}`);
    await p.fill('#ew_s2_u0', ''); await p.waitForTimeout(150); ok((await p.$$eval('#ewChecks li', l => l.map(x => x.textContent))).some(x => /TEV.*units/.test(x)), `${L}: missing units flagged`);
    await p.fill('#ew_s2_u0', '04');
    ok(await ewv(p, 's0_sd') === DAY && await ewv(p, 's1_sd') === DAY, `${L}: service date defaults to the encounter day`);
    await p.fill('#ew_s1_sd', '2026-10-05'); await p.waitForTimeout(150);
    ok((await p.$$eval('#ewChecks li', l => l.map(x => x.textContent))).some(x => /Billing line 2: service date/.test(x)), `${L}: different service date noted in Checks`);
    const fs0 = await p.$eval('#ew_s0_code', el => [parseFloat(getComputedStyle(el).fontSize), el.getBoundingClientRect().height]);
    ok(touch ? fs0[0] >= 16 : fs0[0] <= 14 && fs0[1] <= 30, `${L}: field font ${fs0[0]}px, height ${Math.round(fs0[1])}px`);
    await p.screenshot({ path: path.join(OUT, `v9u-entry-${tag}.png`) });
    if (!touch && /1920/.test(L)) {
      await p.click('#ewWide'); await p.waitForTimeout(300);
      const tops = await p.$$eval('.ewline[data-line="2"] .ewgrid > .ewf', l => l.map(x => Math.round(x.getBoundingClientRect().top)));
      ok(new Set(tops).size === 1 && tops.length === 6, `${L}: wide: billing line on one row (${tops.join(',')})`);
      await p.screenshot({ path: path.join(OUT, `v9u-entry-desktop-wide-1920x1080.png`) });
      await p.click('#ewWide'); await p.waitForTimeout(200);
    }
    if (touch) { await p.$eval('.ewbody', b => { b.scrollTop = b.scrollHeight; }); await p.waitForTimeout(150); await p.screenshot({ path: path.join(OUT, `v9u-entry-${tag}-bottom.png`) }); }
    await p.click('#ewSave'); await p.waitForFunction(() => !document.querySelector('#ewDlg').open, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(700);
    ok(!(await p.$eval('#ewDlg', d => d.open)), `${L}: saved and closed (${await p.$eval('#ewErr', x => x.textContent)})`);
    const r1 = await rowOf(p, 'Thompson-Wakefield, Margaret Anne');
    const g = await p.evaluate(() => { const S = window.__mblState; return null; });
    const fee = await cell(p, r1, 'fee'), m1 = await cell(p, r1, 'mod1'), m2 = await cell(p, r1, 'mod2');
    ok(/03\.03BZ/.test(fee) && /87\.54A/.test(fee) && /03\.01AA/.test(fee) && /CMXV35/.test(m1) && /TEV/.test(m2), `${L}: grid shows codes "${fee}" mod1 "${m1}" mod2 "${m2}"`);
    await tapRn(p, r1, touch);
    ok(await ewv(p, 's2_code') === '03.01AA' && await ewv(p, 's2_m0') === 'TEV' && await ewv(p, 's2_u0') === '04' && await ewv(p, 'skill') === 'OBGY' && await ewv(p, 'sex') === 'F' && await ewv(p, 's1_sd') === '2026-10-05' && await ewv(p, 's0_sd') === DAY && await txt(p, '#ewTotal') === '$178.46', `${L}: reopens with lines, units, details and total`);
    await p.click('#ewCancel'); await p.waitForTimeout(200);
    // a new entry from the empty row picks up the remembered skill
    const rb = await p.evaluate(() => [...document.querySelectorAll('#todayList table.grid tbody tr')].findIndex(tr => tr.dataset.blank));
    if (rb >= 0) { if (touch) await tapRn(p, rb, 1); else { await p.focus(`#todayList table.grid tbody tr:nth-child(${rb + 1}) .gc[data-c="name"]`); await p.keyboard.press('Control+Enter'); await p.waitForSelector('#ewDlg[open]'); await p.waitForTimeout(250); } ok(await ewv(p, 'skill') === 'OBGY' && await ewv(p, 'name') === '', `${L}: new entry window, skill default remembered`); await p.click('#ewCancel'); }
    await ctx.close();
  }
  await cr.close(); await wk.close();
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
