// MBL-F5: a row with an ICD-only line ({c:'', dx:'218'}) must keep it when the Fee code(s) cell is edited or a Fee Desk
// pick comes back; each code keeps its own Dx (matched by code, never by position); the grid shows no leading comma.
// Synthetic data only. Run: cd /workspace/pwtest && BASE=http://127.0.0.1:18995/ node <repo>/tests/icd-only-line-f5.test.js
// (BASE serves this repo's public/ at /medbilling-logs/ and a Fee Desk build at /feedesk/)
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18995/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const FEE = id => `#todayList tr[data-id="${id}"] [data-c="fee"]`;
async function unlock(p) {
  if (!(await p.evaluate(() => document.body.classList.contains('locked')))) await p.click('#lockNow');
  await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(700);
}
async function boot(browser, vp) {
  const ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: vp || { width: 1280, height: 900 } }), p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(300);
  await p.evaluate(async () => { const now = Date.now(), d0 = new Date(now); d0.setHours(0, 0, 0, 0); const at = h => Math.min(d0.getTime() + h * 3600e3, now - (12 - h) * 600e3);
    const mk = (id, h, x) => Object.assign({ id, kind: 'enc', name: 'Synthetic ' + id, mrn: '', chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [], notes: [], segs: [{ s: at(h), e: at(h) + 900e3 }], status: 'done', photos: [], links: [], created: now - 9e6, updated: now - 9e6 }, x);
    await Vault.save(mk('r1', 1, { codes: [{ c: '80.19B', k: '80.19B', d: 'Myomectomy, vaginal', j: 'AB', f: '', dx: '218', dxd: '' }] }));
    await Vault.save(mk('r4', 4, { codes: [{ c: '', k: '', d: '', j: 'AB', f: '', dx: '218' }, { c: '80.19B', k: '80.19B', d: 'Myomectomy, vaginal', j: 'AB', f: '', dx: '218', dxd: '' }] })); });
  await unlock(p); return { ctx, p };
}
const raw = (p, id) => p.evaluate(async id => { const a = await Vault.loadAll(); const l = Array.isArray(a) ? a : (a.encs || Object.values(a)); return JSON.stringify(l.find(x => x && x.id === id)); }, id);
const sp = s => String(s).replace(/\s+/g, '');   // the code list stores e.g. "66.4 A"
const lines = async (p, id) => JSON.parse(await raw(p, id)).codes.map(c => (sp(c.c) || '∅') + '/' + (c.dx || ''));
const val = (p, id) => p.$eval(FEE(id), e => e.value ?? e.textContent).then(v => v.replace(/(\d) (?=[A-Z])/g, '$1'));

(async () => {
  const browser = await chromium.launch();
  // (1) untouched rows byte-identical; (3) no leading comma
  { const { ctx, p } = await boot(browser);
    const r1a = await raw(p, 'r1'), r4a = await raw(p, 'r4');
    ok(await val(p, 'r4') === '80.19B', `grid shows "80.19B" for the ICD-only + 80.19B row, no leading comma ("${await val(p, 'r4')}")`);
    await p.click(FEE('r4')); await p.keyboard.press('Tab'); await p.waitForTimeout(800);
    ok(await raw(p, 'r4') === r4a, 'r4 focused and left without editing: stored record byte-identical');
    await p.click(FEE('r4')); await p.keyboard.press('End'); await p.keyboard.type(', 66.4A'); await p.keyboard.press('Tab'); await p.waitForTimeout(1500);
    ok(await raw(p, 'r1') === r1a, 'r1 (untouched while r4 is edited): stored record byte-identical');
    // (2) the edit keeps the ICD-only line and each code its own Dx
    const l = await lines(p, 'r4');
    ok(JSON.stringify(l) === JSON.stringify(['∅/218', '80.19B/218', '66.4A/']), `typing ", 66.4A" keeps the ICD-only line, 66.4A gets no borrowed Dx (${l.join(' | ')})`);
    ok(await val(p, 'r4') === '80.19B, 66.4A', `cell reads "80.19B, 66.4A" ("${await val(p, 'r4')}")`);
    await p.click(FEE('r4')); await p.keyboard.press('Control+a'); await p.keyboard.type('66.4A, 80.19B'); await p.keyboard.press('Tab'); await p.waitForTimeout(1500);
    const l2 = await lines(p, 'r4');
    ok(JSON.stringify(l2) === JSON.stringify(['∅/218', '66.4A/', '80.19B/218']), `re-ordering keeps 80.19B with Dx 218 (by code, not index) (${l2.join(' | ')})`);
    await ctx.close(); }
  // (4) Fee Desk pick return into the row
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const { ctx, p } = await boot(browser, vp), lb = vp.width;
    await p.locator(FEE('r4')).scrollIntoViewIfNeeded(); await p.click(FEE('r4')); await p.waitForTimeout(200);
    const [fd] = await Promise.all([ctx.waitForEvent('page'), p.locator(`#todayList tr[data-id="r4"] .pickfd[data-kind="fee"]:not(.fdmini)`).first().evaluate(b => b.click())]);
    await fd.waitForLoadState('domcontentloaded'); await fd.waitForSelector('#pickbar', { timeout: 30000 });
    await fd.waitForFunction(() => document.querySelector('#results .savedh, #results .hit, #detail .codebig'), null, { timeout: 30000 });
    await fd.fill('#q', '66.4A'); await fd.press('#q', 'Enter'); await fd.waitForSelector('#results .hit[data-code="66.4A"]', { timeout: 15000 });
    const closed = fd.waitForEvent('close', { timeout: 10000 }).catch(() => null);
    await fd.locator('#results .hit[data-code="66.4A"]').first().click(); await closed;
    const t = Date.now(); while (Date.now() - t < 10000 && !/66\.4A/.test(await val(p, 'r4'))) await p.waitForTimeout(150);
    await p.waitForTimeout(800);
    const l = await lines(p, 'r4');
    ok(JSON.stringify(l) === JSON.stringify(['∅/218', '80.19B/218', '66.4A/']), `${lb}: Fee Desk pick of 66.4A keeps the ICD-only line and Dx pairing (${l.join(' | ')})`);
    ok(await val(p, 'r4') === '80.19B, 66.4A', `${lb}: cell after pick "${await val(p, 'r4')}"`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
