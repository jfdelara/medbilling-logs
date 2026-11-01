// b11 code rows (Jose via Eng, 2026-10-22), rendered by Fee Desk's shared formatRow (public/js/shared/rowfmt.js, vendored):
//   code(·mods) [+N] · short label (2-3 words) · price · [ICD-9]     e.g. "80.19B Myomectomy $308.65 [218]"; ICD-only rows "[218] Uterine leiomyoma"
// with the full description in the tooltip / aria-label (and the detail view). ICD-saved rows must not lead with the diagnosis.
// Views: track-again / Favourite code-set chips (incl. the '· 218 +1' fix), encounter details "Codes", edit-dialog fee search, ICD-9 suggestions and code chips,
// entry-window fee menu (Recent) and ICD-9 menu. No button inside a button.
// 1280 desktop and 390 phone. Synthetic data only. SHOT=/dir/prefix saves <prefix>-<view>-<w>.png.
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:PORT/medbilling-logs/ node /workspace/mbl-wt-uibugs/tests/coderow-b11.test.js
const { chromium } = require('./helpers/cr-welcome');
const URL0 = process.env.URL || 'http://127.0.0.1:18792/medbilling-logs/', PIN = '48203917', SHOT = process.env.SHOT || '';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; }; const errors = [];
const G = '#todayList table.grid';
const FULL = { '80.19B': 'Myomectomy, vaginal', '66.4A': 'Lysis of adhesions', '86.9C': 'Elective Cesarean section' };
const PRICE = { '80.19B': '308.65', '66.4A': '79.69', '86.9C': '700.19', '03.03A': '25.09' };
// row text → { code, label, price, dx }, or null when it does not follow the format
// final API order: codeText(·mods) [+N] label $price [dx]
const parse = t => { const m = /^([0-9]{2}\.[0-9A-Z]+)((?:·[A-Z0-9]+)*)(?:\s+(\+\d+))?\s+((?:[^\s$\[\]]+\s+){0,2}[^\s$\[\]]+)\s+\$([\d,]+\.\d\d)(?:\s+\[([0-9VE][0-9.]*(?:, [0-9VE][0-9.]*)*)\])?$/.exec(t.replace(/\s+/g, ' ').trim()); return m ? { code: m[1], mods: m[2], extra: m[3] || '', label: m[4], price: m[5], dx: m[6] || null } : null; };
const ICDFULL = { '218': 'Uterine leiomyoma' };
function checkIcd(L, view, rows, want) {
  ok(rows.length > 0, `${L} ${view}: rows rendered (${rows.length})`);
  const r = rows.find(x => x.t.trim().startsWith('[' + want + ']'));
  ok(!!r, `${L} ${view}: ICD-only row "[${want}] label" found (${rows.slice(0, 3).map(x => x.t).join(' | ')})`); if (!r) return;
  ok(/^\[[0-9VE][0-9.]*\] \S.{0,40}$/.test(r.t.trim()) && !/\$/.test(r.t), `${L} ${view}: "${r.t.trim()}" reads [ICD-9] short label, no price`);
  ok(r.tip.includes(ICDFULL[want]), `${L} ${view}: full ICD-9 description in tooltip / aria-label`);
  ok(r.oneLine && r.noEllipsis, `${L} ${view}: row shows the full label, no ellipsis`);
}
const noNested = async (p, L, view) => ok(await p.evaluate(() => document.querySelectorAll('button button, button a, a button').length) === 0, `${L} ${view}: no button nested inside a button`);
function check(L, view, rows, want) {
  ok(rows.length > 0, `${L} ${view}: rows rendered (${rows.length})`);
  for (const w of want) {
    const r = rows.find(x => x.t.replace(/\s+/g, ' ').trim().startsWith(w.code + ' ')) || rows.find(x => x.t.includes(w.code));
    if (!r) { ok(false, `${L} ${view}: row for ${w.code} found`); continue; }
    const p = parse(r.t);
    ok(!!p && p.code === w.code, `${L} ${view}: ${w.code} row reads code · short label · price · [ICD-9] ("${r.t.replace(/\s+/g, ' ').trim()}")`);
    if (!p) continue;
    const words = p.label.split(' ').length;
    ok(words >= 1 && words <= 3 && p.label.length <= 28, `${L} ${view}: ${w.code} short label "${p.label}" (${words} word${words > 1 ? 's' : ''})`);
    ok(p.price.replace(',', '') === PRICE[w.code], `${L} ${view}: ${w.code} price $${p.price} (fee list $${PRICE[w.code]})`);
    ok(w.dx ? p.dx === w.dx : p.dx === null, `${L} ${view}: ${w.code} ICD-9 ${w.dx ? '[' + w.dx + '] last, right after the price' : 'absent → nothing after the price'} (got ${p.dx})`);
    if (FULL[w.code]) ok(r.tip.includes(FULL[w.code]), `${L} ${view}: ${w.code} full description in tooltip / aria-label ("${r.tip.slice(0, 60)}")`);
    ok(r.oneLine, `${L} ${view}: ${w.code} row shows the full label, nothing cut off (S3: wraps if needed)`);
    ok(r.noEllipsis, `${L} ${view}: ${w.code} row has no ellipsis`);
    ok(r.aria.includes('$' + PRICE[w.code]) || r.tip.split(' | ').some(t => t.includes(w.code) && t.includes('$' + PRICE[w.code])), `${L} ${view}: ${w.code} aria-label includes the price $${PRICE[w.code]} (S5)`);
  }
  for (const r of rows) { const t = r.t.replace(/\s+/g, ' ').trim(); if (t) ok(/^\d{2}\.\d+[A-Z]/.test(t), `${L} ${view}: row leads with the fee code, not a diagnosis or separator ("${t.slice(0, 40)}")`); }
}
const grab = (p, sel) => p.$$eval(sel, l => l.filter(e => e.offsetParent || e.getClientRects().length).map(e => { const c = e.cloneNode(true); c.querySelectorAll('small, .x, a, .fpck').forEach(n => n.remove());
  const lh = parseFloat(getComputedStyle(e).lineHeight) || 20, r = e.getBoundingClientRect();
  const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT), parts = []; while (tw.nextNode()) parts.push(tw.currentNode.nodeValue.trim()); return { t: parts.filter(Boolean).join(' '), tip: [e.title, e.getAttribute('aria-label'), ...[...e.querySelectorAll('[title],[aria-label]')].map(n => n.title + ' ' + (n.getAttribute('aria-label') || ''))].filter(Boolean).join(' | '), oneLine: [e, ...e.querySelectorAll('*')].every(n => n.scrollWidth <= n.clientWidth + 1 || getComputedStyle(n).overflowX === 'visible'), noEllipsis: [e, ...e.querySelectorAll('.crow, .crow *')].every(n => getComputedStyle(n).textOverflow !== 'ellipsis'), aria: e.getAttribute('aria-label') || '' }; }));

// B11-fit: at 320/360/390 the code, price and [ICD-9] parts of every visible chip/row must lie inside the viewport, inside their row and
// chip, and inside every clipping ancestor (overflow not visible); row and chip scrollWidth <= clientWidth.
async function fitCheck(p, L, view, sel) {
  const r = await p.$$eval(sel, (l, W) => { const out = { n: 0, parts: 0, bad: [] };
    for (const e of l) { if (!(e.offsetParent || e.getClientRects().length)) continue; out.n++;
      const chip = e.closest('.tchip, .chit, .ewo, .cdpair, .sc') || e, rows = [e, chip], er = e.getBoundingClientRect();
      for (const x of rows) if (x.scrollWidth > x.clientWidth + 1) out.bad.push(`${x.className} scrollWidth ${x.scrollWidth} > clientWidth ${x.clientWidth}`);
      for (const q of e.querySelectorAll('.crc, .crp, .cri')) { const b = q.getBoundingClientRect(); if (!b.width) continue; out.parts++;
        const tag = `${q.className.split(' ')[0]} "${q.textContent.trim()}"`, inside = (a, n) => { if (b.left < a.left - 1 || b.right > a.right + 1) out.bad.push(`${tag} [${b.left | 0},${b.right | 0}] outside ${n} [${a.left | 0},${a.right | 0}]`); };
        inside({ left: 0, right: W }, 'viewport'); inside(er, 'row'); inside(chip.getBoundingClientRect(), 'chip');
        if (getComputedStyle(q).flexShrink !== '0') out.bad.push(`${tag} flex-shrink ${getComputedStyle(q).flexShrink}`);
        for (let a = q.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') inside(a.getBoundingClientRect(), 'clipping ' + (a.id ? '#' + a.id : a.className.split(' ')[0] || a.tagName));
      } }
    return out; }, await p.evaluate(() => document.documentElement.clientWidth));
  ok(r.n > 0 && r.bad.length === 0, `${L} ${view}: ${r.n} rows, ${r.parts} code/price/ICD parts fit viewport, row, chip and clipping ancestors${r.bad.length ? ' — ' + r.bad.slice(0, 4).join('; ') : ''}`);
}
async function run(browser, vp, L) {
  const phone = vp.width < 500, ctx = await browser.newContext(Object.assign({ timezoneId: 'America/Edmonton', viewport: vp }, phone ? { isMobile: true, hasTouch: true } : {})), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(L + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/^Refused to apply a stylesheet/.test(m.text())) errors.push(L + ': ' + m.text()); });
  const shot = async v => { if (SHOT) await p.screenshot({ path: `${SHOT}-${v}-${vp.width}.png` }); };
  await p.goto(URL0); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(300);
  await p.evaluate(async FULL => { const now = Date.now(), d0 = new Date(now); d0.setHours(0, 0, 0, 0); const at = h => Math.min(d0.getTime() + h * 3600e3, now - (12 - h) * 600e3);
    const mk = (id, h, x) => Object.assign({ id, kind: 'enc', name: 'Code Row ' + id, mrn: '', chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [], notes: [], segs: [{ s: at(h), e: at(h) + 900e3 }], status: 'done', photos: [], links: [], created: now - 9e6, updated: now - 9e6 }, x);
    const cd = (c, dx) => ({ c, k: c, d: FULL[c] || '', j: 'AB', f: '', dx, dxd: '' });
    await Vault.save(mk('r1', 1, { codes: [cd('80.19B', '218')] }));
    await Vault.save(mk('r2', 2, { codes: [cd('66.4A', '568.0')] }));
    await Vault.save(mk('r3', 3, { codes: [cd('86.9C', '')] }));
    await Vault.save(mk('r4', 4, { codes: [{ c: '', k: '', d: '', j: 'AB', f: '', dx: '218' }, cd('80.19B', '218')] }));   // ICD-saved first line
  }, FULL);
  await p.click('#lockNow'); await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn'); await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(700);
  // 1. track-again chips (inside the ⋯ More menu), starred → Favourites
  const more = async () => { if (await p.isHidden('#moreMenu')) await p.click('#moreBtn'); await p.waitForTimeout(250); };
  await more();
  for (let k = 0; k < 6; k++) { const n = await p.$$eval('#trackAgain .tchip:not(.fav) .tstar', l => l.length); if (!n) break; await p.$eval('#trackAgain .tchip:not(.fav) .tstar', b => b.click()); await p.waitForTimeout(350); await more(); }
  await p.$eval('#trackAgain', e => e.scrollIntoView({ block: 'center' })).catch(() => {}); await shot('favchips');
  await fitCheck(p, L, 'More/Track again chips (fit)', '#trackAgain .tchip .tgo'); check(L, 'Favourite code-set chips', await grab(p, '#trackAgain .tchip.fav .tgo'), [{ code: '80.19B', dx: '218' }, { code: '66.4A', dx: '568.0' }, { code: '86.9C', dx: null }]);
  await noNested(p, L, 'chips');
  { // '· 218 +1' bug: a code set whose first line is Dx-only must still lead with its first fee code, no stray separator or +1
    const all = await grab(p, '#trackAgain .tchip .tgo'), r4 = all.find(x => /Start a timer with ICD-9 218/.test(x.tip));
    ok(!!r4, `${L} chips: Dx-first code set (r4) shown (${all.map(x => x.t).join(' | ')})`);
    if (r4) ok(r4.t.trim() === '80.19B Myomectomy $308.65 [218]', `${L} chips: Dx-first set reads "80.19B Myomectomy $308.65 [218]" (got "${r4.t.trim()}")`);
    ok(all.every(x => !/^\s*[·+\[]/.test(x.t) && !/· 218|\+1\b/.test(x.t)), `${L} chips: no chip reads '· 218 +1' or leads with a separator/diagnosis`);
  }
  // 2. encounter details (view mode) for row 1
  await p.click('#tabs [data-tab="today"]'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.$eval(`${G} tbody tr:nth-child(1) th.rn`, e => e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))).catch(() => {}); await p.waitForSelector('#editDlg[open]', { timeout: 5000 }).catch(() => {});
  if (await p.$('#editDlg[open]')) { await shot('details'); await fitCheck(p, L, 'Encounter details Codes (fit)', '#eSummary .sc'); check(L, 'Encounter details Codes', await grab(p, '#eSummary .sc'), [{ code: '80.19B', dx: '218' }]);
    // 3. edit-dialog fee search
    if (await p.isHidden('#eCodeQ')) await p.click('#eaEdit').catch(() => {});
    await p.fill('#eCodeQ', 'myomectomy'); await p.waitForTimeout(800); await shot('feesearch');
    await fitCheck(p, L, 'Edit fee search (fit)', '#eCodeRes .chit:not([data-typed])'); check(L, 'Edit fee search results', await grab(p, '#eCodeRes .chit:not([data-typed])'), [{ code: '80.19B', dx: null }]);
    await noNested(p, L, 'fee search');
    // 3b. code chips in the edit list (line 1: code · label · price; Dx has its own field)
    await p.$eval('#eCodes', e => e.scrollIntoView({ block: 'center' })).catch(() => {}); await shot('editchips');
    await fitCheck(p, L, 'Edit code chips (fit)', '#eCodes .cdpair .cl1'); check(L, 'Edit code chips', await grab(p, '#eCodes .cdpair .cl1'), [{ code: '80.19B', dx: null }]);
    // 3c. ICD-9 suggestions
    await p.fill('#eCodeQ', ''); await p.fill('#eDxQ', 'leiomyoma'); await p.waitForTimeout(800); await shot('dxsearch');
    await fitCheck(p, L, 'Edit ICD-9 suggestions (fit)', '#eDxRes .chit:not([data-typed])'); checkIcd(L, 'Edit ICD-9 suggestions', await grab(p, '#eDxRes .chit:not([data-typed])'), '218');
    await noNested(p, L, 'dx search');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  } else ok(false, `${L}: details dialog opened`);
  // 4. entry-window fee field menu (Recent)
  if (await p.$('#editDlg[open]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  if (phone) await p.tap(`${G} tbody tr:nth-child(3) th.rn`).catch(() => {}); else { await p.focus(`${G} tbody tr:nth-child(3) .gc[data-c="name"]`).catch(() => {}); await p.keyboard.press('Control+Enter'); }
  await p.waitForSelector('#ewDlg[open]', { timeout: 5000 }).catch(() => {});
  if (await p.$('#ewDlg[open]')) { await p.click('[data-dd="s0_code"]').catch(() => {}); await p.waitForSelector('#ewMenu:not([hidden]) .ewo', { timeout: 5000 }).catch(() => {}); await shot('ewmenu');
    await fitCheck(p, L, 'Entry-window fee menu (fit)', '#ewMenu .ewo:not(.act)'); { const fm = await grab(p, '#ewMenu .ewo:not(.act)'); check(L, 'Entry-window fee menu', fm, [{ code: '80.19B', dx: null }, { code: '66.4A', dx: null }]);
      ok(fm.every(x => x.t.trim()), `${L} entry-window fee menu: no blank Recent line for a Dx-only code line (S4)`); }
    { const brk = (await p.textContent('#ew_s0_brk').catch(() => '')) || ''; ok(/Expected payment: fee \$700\.19/.test(brk) && !/\bbase\b/.test(brk), `${L} entry window: Expected payment reads 'fee $x', never 'base' (S2) ("${brk}")`); }
    await noNested(p, L, 'entry-window menu');
    // 4b. ICD-9 field menu (Recent): ICD-only rows
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.click('[data-dd="s0_dx"]').catch(() => {}); await p.waitForSelector('#ewMenu:not([hidden]) .ewo', { timeout: 5000 }).catch(() => {}); await shot('ewdxmenu');
    await fitCheck(p, L, 'Entry-window ICD-9 menu (fit)', '#ewMenu .ewo:not(.act)'); checkIcd(L, 'Entry-window ICD-9 menu', await grab(p, '#ewMenu .ewo:not(.act)'), '218');
  } else ok(false, `${L}: entry window opened`);
  await ctx.close();
}
(async () => {
  const b = await chromium.launch();
  for (const [vp, L] of [[{ width: 1280, height: 800 }, '1280'], [{ width: 390, height: 844 }, '390'], [{ width: 360, height: 780 }, '360'], [{ width: 320, height: 640 }, '320']].filter(([v]) => !process.env.WIDTHS || process.env.WIDTHS.split(',').includes(String(v.width)))) { try { await run(b, vp, L); } catch (e) { ok(false, `${L} run: ${e.message.split('\n')[0]}`); } }
  await b.close();
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
