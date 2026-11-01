// b11 UI bug fixes (fix/mbl-b11-ui-bugs): one check per fix.
//  1 desktop: hover camera / ↗ buttons stay in a slim strip at the name cell's right edge (centre and text stay clickable/visible)
//  2 totals row has one cell per column (Sex cell after the name)
//  3 phone-fit: "+ same" stays inside its own row and the # column
//  4 desktop 1280 / 1366: no sideways scroll (full matrix in wide-v9q / grid-v9f)
//  5 typing R on a selected Billing notes cell edits the note (Clinical Resources drawer stays closed)
//  7 phone: active-row camera / ↗ buttons never cover the name text
//  6 touch events without touches / changedTouches don't throw (app.js touchstart / touchend guards)
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18997/medbilling-logs/ node <worktree>/tests/ui-bugs-b11.test.js
const { chromium } = require('./helpers/cr-welcome');
const URL = process.env.URL || 'http://127.0.0.1:18792/medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errors = [];
async function setup(b, vp, mob, L) {
  const c = await b.newContext(Object.assign({ viewport: vp, timezoneId: 'America/Edmonton' }, mob ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {})), p = await c.newPage();
  p.on('pageerror', e => errors.push(L + ': ' + e.message));
  await p.goto(URL); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(1200);
  await p.evaluate(async () => { const s = Date.now() - 3 * 3600000; const N = ['Fake, Patient One', 'Testperson-Longername, Alexandra Maria', 'Fake, Patient Three'];
    for (let i = 0; i < 3; i++) await Vault.save({ id: 'e' + i, kind: 'enc', name: N[i], mrn: '90000000' + i, chart: '', label: '', initials: '', billingNote: 'Consult follow-up note ' + i, setting: 'H', facility: null, type: '', codes: [{ c: '03.03A', k: '03.03A', d: '', j: 'AB', f: '', dx: '650' }], notes: [], segs: [{ s: s + i * 3600000, e: s + i * 3600000 + 20 * 60000 }], status: 'done', photos: [], links: [], created: s, updated: s }); });
  await p.click('#lockNow'); await p.fill('#uPass', PIN); await p.click('#uBtn'); await p.waitForTimeout(1500);
  return { c, p };
}
(async () => {
  const b = await chromium.launch();
  for (const w of [1280, 1366]) {
    const L = `${w}`, { c, p } = await setup(b, { width: w, height: 800 }, false, L), nm = '#todayList tbody tr:nth-child(1) td.c-name';
    await p.hover(nm, { position: { x: 6, y: 6 } }); await p.waitForTimeout(300);
    const g = await p.evaluate(sel => { const td = document.querySelector(sel), r = td.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), ta = td.querySelector('.gc[data-c="name"]');
      const bs = [...td.querySelectorAll('.rscan,.rew')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.getBoundingClientRect());
      const cs = getComputedStyle(ta), textRight = ta.getBoundingClientRect().right - parseFloat(cs.paddingRight);
      return { n: bs.length, centre: el.dataset.c || el.className, minLeft: Math.min(...bs.map(x => x.left)) - r.left, textRight: textRight - r.left, w: r.width }; }, nm);
    ok(g.n === 2 && g.centre === 'name', `${L}: hovering a filled row shows camera + ↗ and the name cell's centre is still the name (${g.centre})`);
    ok(g.minLeft >= g.textRight - 1 && g.minLeft >= g.w - 21, `${L}: the buttons sit in the right-edge strip, clear of the text (buttons from ${Math.round(g.minLeft)}px, text ends ${Math.round(g.textRight)}px of ${Math.round(g.w)}px)`);
    const t = await p.evaluate(() => { const t = document.querySelector('#todayList table.grid'), f = [...t.tFoot.rows[0].cells], H = [...t.tHead.rows[0].cells];
      return { foot: f.reduce((a, x) => a + (x.colSpan || 1), 0), cols: t.querySelectorAll('colgroup col').length, sexAligned: Math.round(f[2].getBoundingClientRect().left) === Math.round(H[2].getBoundingClientRect().left) }; });
    ok(t.foot === t.cols && t.sexAligned, `${L}: totals row has one cell per column (${t.foot}/${t.cols}) and lines up with the header`);
    const s = await p.evaluate(() => { const g = document.querySelector('#todayList .gwrap'); return [g.scrollWidth, g.clientWidth]; });
    ok(s[0] <= s[1], `${L}: no sideways scroll (${s[0]}/${s[1]})`);
    if (w === 1280) {
      await p.click('#todayList tbody tr:nth-child(1) .gc[data-c="dx"]'); await p.keyboard.press('Tab'); await p.keyboard.type('R'); await p.waitForTimeout(400);
      const r = await p.evaluate(() => ({ dr: document.getElementById('crDrawer').hidden, val: (document.querySelector('#noteEd textarea') || {}).value }));
      ok(r.dr && r.val === 'R', `${L}: typing R on a selected Billing notes cell edits the note ("${r.val}") and Clinical Resources stays closed (${r.dr ? 'closed' : 'OPEN'})`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      await p.locator('body').click({ position: { x: 5, y: 5 } }); await p.keyboard.press('r'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => !document.getElementById('crDrawer').hidden), `${L}: R outside the grid still opens Clinical Resources`);
    }
    await c.close();
  }
  { const L = '390', { c, p } = await setup(b, { width: 390, height: 844 }, true, L);
    await p.locator('#todayList tbody tr:nth-child(1) .gc[data-c="name"]').tap({ position: { x: 8, y: 8 } }); await p.waitForTimeout(500);
    const s = await p.evaluate(() => { const s = document.querySelector('#todayList tbody tr.act .spb'); if (!s) return null; const r = s.getBoundingClientRect(), tr = s.closest('tr').getBoundingClientRect(), nx = s.closest('tr').nextElementSibling.querySelector('td.c-name').getBoundingClientRect(), vis = getComputedStyle(s).display !== 'none';
      return { vis, inRow: r.top >= tr.top - 0.5 && r.bottom <= tr.bottom + 0.5, clearName: r.right <= nx.left + 0.5, box: [r.width, r.height].map(Math.round) }; });
    ok(s && s.vis && s.inRow && s.clearName, `${L}: "+ same" stays inside its own row and the # column (${s && s.box.join('×')})`);
    // 7 phone: on the active row the camera / ↗ buttons sit right of the name text box, never over the name (Eng call 2026-10-22)
    const pc = await p.evaluate(() => { const td = document.querySelector('#todayList tbody tr.act td.c-name'); if (!td) return null; const ta = td.querySelector('.gc[data-c="name"]'), cs = getComputedStyle(ta), tr = ta.getBoundingClientRect();
      const bs = [...td.querySelectorAll('.rscan,.rew')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.getBoundingClientRect());
      return { n: bs.length, textRight: Math.round(tr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)), btnLeft: Math.round(Math.min(...bs.map(x => x.left))), textW: Math.round(tr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) }; });
    ok(pc && pc.n === 2 && pc.btnLeft >= pc.textRight && pc.textW >= 40, `${L}: active row: camera + ↗ sit right of the name text (buttons from ${pc && pc.btnLeft}px, text ends ${pc && pc.textRight}px, text box ${pc && pc.textW}px wide)`);
    if (process.env.SHOT) { const r = await p.locator('#todayList tbody tr.act').boundingBox(); await p.screenshot({ path: process.env.SHOT, clip: { x: 0, y: Math.max(0, r.y - 30), width: 390, height: r.height + 60 } }); }
    { const sw = await p.evaluate(() => { const g = document.querySelector('#todayList .gwrap'); return [g.scrollWidth, g.clientWidth]; }); ok(true, `${L}: (info) sheet width ${sw.join("/")}`); }
    const e0 = errors.length;
    await p.evaluate(() => { const el = document.querySelector('#todayList'), mk = (type, o) => { const e = new Event(type, { bubbles: true }); Object.assign(e, o); return e; };
      el.dispatchEvent(mk('touchstart', { touches: [] })); el.dispatchEvent(mk('touchstart', {}));
      el.dispatchEvent(mk('touchstart', { touches: [{ clientX: 10, clientY: 10 }] })); el.dispatchEvent(mk('touchend', {}));
      el.dispatchEvent(mk('touchstart', { touches: [{ clientX: 10, clientY: 10 }] })); el.dispatchEvent(mk('touchend', { changedTouches: [] })); });
    await p.waitForTimeout(300);
    ok(errors.length === e0, `${L}: touch events without touches / changedTouches don't throw (${errors.slice(e0).join('; ') || 'no errors'})`);
    await c.close(); }
  ok(errors.length === 0, `no page errors (${errors.join(' | ') || 'none'})`);
  await b.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
