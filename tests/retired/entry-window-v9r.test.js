// v9r: the entry window (tap / click a row number → every field of the row in one window; full-screen sheet on phones),
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
(async () => {
  const cr = await chromium.launch(), wk = await webkit.launch();
  // ---------- desktop
  for (const [w, h] of (process.env.ONLY_P ? [] : process.env.ONLY_D ? [[1280, 800]] : [[1280, 800], [1920, 1080]])) {
    const L = `desktop ${w}x${h}`, { ctx, p } = await open(cr, { viewport: { width: w, height: h } }, L);
    ok(!!(await p.$('#todayList th.h-ref')), `${L}: v9s: Referring provider column is on by default`);
    await p.evaluate(() => document.querySelector('#refCol').click()); await p.waitForTimeout(600); ok(!(await p.$('#todayList th.h-ref')), `${L}: Settings switch turns it off`);
    await tapRn(p, 0);
    const vals = {}; for (const k of ['name', 'mrn', 'hc', 'tin', 'tout', 'fno', 'fcen', 'fee', 'mod1', 'mod2', 'dx', 'note']) vals[k] = await ewv(p, k);
    ok(vals.name === 'Thompson-Wakefield, Margaret Anne' && vals.mrn === '123456789' && vals.fno === '88001' && vals.fcen === 'OBST' && vals.fee === '03.03A' && vals.mod1 === 'CMGP' && vals.dx === 'V22.2' && vals.note === 'Seen in L&D triage' && /^\d\d:\d\d$/.test(vals.tin) && /^\d\d:\d\d$/.test(vals.tout), `${L}: window shows every field of row 1 ${JSON.stringify(vals)}`);
    ok(!(await p.$('#ew_refNm')), `${L}: no referring provider fields while the column is off`);
    const box = await p.$eval('#ewDlg', d => { const r = d.getBoundingClientRect(); return [r.width, r.height, innerWidth, innerHeight]; });
    ok(box[0] < box[2] && box[1] <= box[3], `${L}: centred window (${Math.round(box[0])}×${Math.round(box[1])})`);
    ok(await p.$$eval('#ewBody .ewdd', l => l.length) >= 11, `${L}: every typed field has a ▾ choices button`);
    // fee: type + search drop-down, pick a result (appends), typed entry still allowed
    await p.focus('#ew_fee'); await p.keyboard.press('End'); await p.keyboard.type(', 03.04');
    await p.waitForSelector('#ewMenu:not([hidden]) .ewo'); const secs = await p.$$eval('#ewMenu .ewsec', l => l.map(x => x.textContent));
    ok(secs.some(s => /Fee schedule search/.test(s)), `${L}: fee code drop-down searches the fee schedule (${secs.join(' | ')})`);
    await p.click('#ewMenu .ewo:has(.ewc:text-is("03.04A"))').catch(async () => { await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); });
    ok(/^03\.03A, 03\.04A/.test(await ewv(p, 'fee')), `${L}: picked code appended ("${await ewv(p, 'fee')}")`);
    // modifier ▾ shows recent + common
    await p.click('[data-dd="mod2"]'); await p.waitForSelector('#ewMenu:not([hidden]) .ewo');
    const ms = await p.$$eval('#ewMenu .ewc', l => l.map(x => x.textContent)); ok(ms.includes('TEV') && ms.includes('CMGP'), `${L}: modifier ▾ lists recent and common modifiers`);
    await p.click('#ewMenu .ewo:has(.ewc:text-is("TEV"))'); ok(/TEV/.test(await ewv(p, 'mod2')), `${L}: modifier picked into Modifier code 2`);
    // functional centre ▾ and Facility # ▾ (recent/favourite)
    await p.click('[data-dd="fcen"]'); await p.waitForSelector('#ewMenu:not([hidden]) .ewo'); const fc = await p.$$eval('#ewMenu .ewc', l => l.map(x => x.textContent)); ok(fc.includes('MED') && fc.includes('EMRG'), `${L}: functional centre ▾ lists the codes`);
    await p.click('#ewMenu .ewo:has(.ewc:text-is("MED"))');
    await p.fill('#ew_note', 'Seen in L&D triage; reassessed');
    if (w === 1280) await p.screenshot({ path: path.join(OUT, `popup-desktop-${w}x${h}.png`) });
    await p.click('[data-dd="dx"]'); await p.waitForSelector('#ewMenu:not([hidden]) .ewo'); if (w === 1920) await p.screenshot({ path: path.join(OUT, `popup-desktop-${w}x${h}-dropdown.png`) });
    await p.keyboard.press('Escape'); ok(await p.$eval('#ewDlg', d => d.open), `${L}: Esc closes the drop-down first, not the window`);
    await p.click('#ewSave'); await p.waitForFunction(() => !document.querySelector('#ewDlg').open); await p.waitForTimeout(600);
    ok(/03\.03A, 03\.04A/.test(await cell(p, 0, 'fee')) && (await cell(p, 0, 'fcen')) === 'MED' && /TEV/.test(await cell(p, 0, 'mod2')), `${L}: Save writes the row (fee "${await cell(p, 0, 'fee')}", fcen ${await cell(p, 0, 'fcen')}, mod2 ${await cell(p, 0, 'mod2')})`);
    // Cancel drops changes
    await tapRn(p, 1); await p.fill('#ew_name', 'SHOULD NOT SAVE'); await p.click('#ewCancel'); await p.waitForTimeout(400);
    ok((await cell(p, 1, 'name')) === 'Nguyen, Linh', `${L}: Cancel drops the changes`);
    // Next / Previous save and move
    await tapRn(p, 1); await p.fill('#ew_mrn', '987654322'); await p.click('#ewNext'); await p.waitForFunction(() => document.querySelector('#ew_name') && document.querySelector('#ew_name').value === 'Okonkwo, Chukwuemeka', null, { timeout: 5000 }).catch(() => {});
    ok((await ewv(p, 'name')) === 'Okonkwo, Chukwuemeka', `${L}: Next goes to the next patient`);
    ok((await cell(p, 1, 'mrn')) === '987654322', `${L}: Next saved the previous patient first`);
    await p.click('#ewPrev'); await p.waitForTimeout(500); ok((await ewv(p, 'name')) === 'Nguyen, Linh', `${L}: Previous goes back`);
    // Next from the last patient = the first empty row (new entry)
    await p.click('#ewNext'); await p.waitForTimeout(400); await p.click('#ewNext'); await p.waitForTimeout(500);
    ok((await p.textContent('#ewT')) === 'New entry', `${L}: after the last patient, Next opens a new entry`);
    await p.fill('#ew_name', 'Smith, Jo'); await p.click('[data-dd="mrn"]'); await p.waitForTimeout(200);
    await p.fill('#ew_mrn', '111222333'); await p.fill('#ew_tin', '10:15'); await p.fill('#ew_tout', '10:40'); await p.fill('#ew_fee', '03.01AA'); await p.fill('#ew_fcen', 'xx');
    await p.click('#ewSave'); await p.waitForTimeout(500); const err = await p.textContent('#ewErr');
    ok(/functional centre/i.test(err) && await p.$eval('#ewDlg', d => d.open), `${L}: a bad value keeps the window open with a message ("${err}")`);
    await p.fill('#ew_fcen', 'CLNC'); await p.click('#ewSave'); await p.waitForFunction(() => !document.querySelector('#ewDlg').open); await p.waitForTimeout(700);
    { const r = await rowOf(p, 'Smith, Jo'); ok(r >= 0 && (await cell(p, r, 'tin')) === '10:15' && (await cell(p, r, 'tout')) === '10:40' && (await cell(p, r, 'fee')) === '03.01AA' && (await cell(p, r, 'fcen')) === 'CLNC', `${L}: new entry created from the window (row ${r + 1}, sorted by In)`); }
    // ⋯ menu entry and Ctrl+Enter
    await p.click('#todayList table.grid tbody tr:nth-child(2) .rmore'); await p.click('#rowMenu [data-rmi="ew"]'); await p.waitForSelector('#ewDlg[open]');
    ok((await ewv(p, 'name')) === 'Nguyen, Linh', `${L}: ⋯ → Open entry window`); await p.click('#ewCancel');
    await p.click(`#todayList table.grid tbody tr:nth-child(${(await rowOf(p, 'Okonkwo, Chukwuemeka')) + 1}) .gc[data-c="mrn"]`); await p.keyboard.press('Control+Enter'); await p.waitForSelector('#ewDlg[open]');
    ok((await ewv(p, 'name')) === 'Okonkwo, Chukwuemeka', `${L}: Ctrl+Enter in a cell opens the window (${await ewv(p, 'name')})`); await p.click('#ewCancel');
    // Referring provider on
    await p.evaluate(() => document.querySelector('#refCol').click()); await p.waitForTimeout(700);
    ok(!!(await p.$('#todayList th.h-ref')), `${L}: Settings switch shows the Referring provider column`);
    const g = await p.evaluate(() => { const w = document.querySelector('#todayList .gwrap'), t = w.querySelector('table'); const ths = [...t.tHead.rows[0].cells].map(c => Math.round(c.getBoundingClientRect().left)), tds = [...t.tBodies[0].rows[0].cells].map(c => Math.round(c.getBoundingClientRect().left)); const last = t.tHead.rows[0].cells[ths.length - 1].getBoundingClientRect().right, wr = w.getBoundingClientRect(); return { align: JSON.stringify(ths) === JSON.stringify(tds), n: ths.length, fits: Math.round(last) <= Math.round(wr.left + w.clientLeft + w.clientWidth), sl: w.scrollWidth - w.clientWidth, cw: [...t.querySelectorAll('col')].map(c => c.className.slice(2) + ':' + Math.round(c.getBoundingClientRect().width)).join(' '), more: !!t.querySelector('tbody tr .rmore') && t.querySelector('tbody tr .rmore').getBoundingClientRect().width > 10 }; });
    ok((g.fits || w < 1440) && g.more, `${L}: with the column on, every column fits (1440 px and up; 1280 may scroll a little) and the window and ⋯ is visible (${JSON.stringify(g)})`);
    ok(g.align && g.n === 17, `${L}: 17 columns, header and rows aligned (${JSON.stringify(g)})`);
    const c = await p.$('#todayList table.grid tbody tr:nth-child(2) .gc[data-c="ref"]'); await c.click(); await p.keyboard.type('Dr. A. Patel, 45678'); await p.keyboard.press('Tab'); await p.waitForTimeout(700);
    await tapRn(p, 1); ok((await ewv(p, 'refNm')) === 'Dr. A. Patel' && (await ewv(p, 'refId')) === '45678', `${L}: grid cell "Name, ID" splits into name + practitioner ID`);
    await p.click('#ewNext'); await p.waitForTimeout(500); await p.click('[data-dd="refNm"]'); await p.waitForSelector('#ewMenu:not([hidden]) .ewo');
    await p.click('#ewMenu .ewo'); ok((await ewv(p, 'refId')) === '45678', `${L}: recent referring provider fills name and ID`);
    if (w === 1280) await p.screenshot({ path: path.join(OUT, `popup-desktop-${w}x${h}-referring.png`) });
    await p.click('#ewSave'); await p.waitForTimeout(700); ok(/Patel, 45678/.test(await cell(p, 2, 'ref')), `${L}: saved to the Referring provider cell`);
    await p.screenshot({ path: path.join(OUT, `grid-referring-column-${w}x${h}.png`) });
    await p.evaluate(() => document.querySelector('#refCol').click()); await p.waitForTimeout(600);
    ok(!(await p.$('#todayList th.h-ref')), `${L}: switching it off hides the column again`);
    await ctx.close();
  }
  // ---------- phones
  if (!process.env.ONLY_D) for (const [engine, br] of [['chromium', cr], ['webkit', wk]]) {
    for (const [w, h] of [[390, 844], [375, 667]]) {
      const L = `${engine} phone ${w}x${h}`, { ctx, p } = await open(br, { viewport: { width: w, height: h }, userAgent: IPHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, L);
      await tapRn(p, 0, true);
      const b = await p.$eval('#ewDlg', d => { const r = d.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
      ok(b[0] === 0 && b[1] === 0 && b[2] === w && Math.abs(b[3] - h) <= 1, `${L}: full-screen sheet ${JSON.stringify(b)}`);
      const fs16 = await p.$$eval('#ewBody .ewi', l => l.every(x => parseFloat(getComputedStyle(x).fontSize) >= 16)); ok(fs16, `${L}: fields 16 px+ (no iPhone zoom)`);
      const ft = await p.$eval('.ewft', f => { const r = f.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top > 0; }); ok(ft, `${L}: Save / Cancel stay on screen`);
      ok((await ewv(p, 'fee')) === '03.03A', `${L}: values shown`);
      if (engine === 'webkit' && w === 390) await p.screenshot({ path: path.join(OUT, `popup-phone-${w}x${h}.png`) });
      await p.$eval('#ew_fee', el => el.scrollIntoView({ block: 'center' })); await (await p.$('[data-dd="fee"]')).tap(); await p.waitForSelector('#ewMenu:not([hidden]) .ewo');
      const mb = await p.$eval('#ewMenu', m => { const r = m.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }); ok(mb, `${L}: drop-down fits the screen`);
      if (engine === 'webkit' && w === 390) await p.screenshot({ path: path.join(OUT, `popup-phone-${w}x${h}-dropdown.png`) });
      await (await p.$('#ewMenu .ewo')).tap(); await (await p.$('#ewSave')).tap(); await p.waitForFunction(() => !document.querySelector('#ewDlg').open);
      ok(true, `${L}: saved from the sheet`);
      await ctx.close();
    }
  }
  console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'console errors: none'); if (errors.length) fails++;
  await cr.close(); await wk.close();
  console.log(fails ? `${fails} FAILURE(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
