// MBL-F5 (Eng CEO ruling 1): Dx-cell edits keep ICD-only lines ({c:'', dx}) and match each Dx to its line by code, never by
// position; new Dx codes go beside fee codes without one, the rest become extras (dxx). Plus ruling 2: on a row with no fee
// code and an entry-level Dx, a linked Fee Desk pick gives the fee its linked ICD and keeps the old Dx as an ICD-only line.
// Synthetic data only. Run: cd /workspace/pwtest && BASE=http://127.0.0.1:18995/ node <repo>/tests/dx-cell-f5.test.js
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18995/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const DX = id => `#todayList tr[data-id="${id}"] [data-c="dx"]`, FEE = id => `#todayList tr[data-id="${id}"] [data-c="fee"]`;
const L = (c, dx) => ({ c, k: c, d: '', j: 'AB', f: '', dx, dxd: '' });
const SEED = {
  r1: { codes: [L('80.19B', '218')] },
  r4: { codes: [L('', '218'), L('80.19B', '218')] },
  r6: { codes: [L('', '218')] },
  r7: { codes: [], dx: '218' },
  r8: { codes: [L('', '218'), L('80.19B', ''), L('66.4A', '568.0')] },
  r9: { codes: [L('80.19B', '218'), L('66.4A', '568.0')] },
};
async function unlock(p) {
  if (!(await p.evaluate(() => document.body.classList.contains('locked')))) await p.click('#lockNow');
  await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(700);
}
async function boot(browser) {
  const ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: { width: 1280, height: 900 } }), p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(300);
  await p.evaluate(async SEED => { const now = Date.now(), d0 = new Date(now); d0.setHours(0, 0, 0, 0); const at = h => Math.min(d0.getTime() + h * 3600e3, now - (12 - h) * 600e3);
    let h = 1; for (const [id, x] of Object.entries(SEED)) { await Vault.save(Object.assign({ id, kind: 'enc', name: 'Synthetic ' + id, mrn: '', chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [], notes: [], segs: [{ s: at(h), e: at(h) + 900e3 }], status: 'done', photos: [], links: [], created: now - 9e6, updated: now - 9e6 }, JSON.parse(JSON.stringify(x)))); h++; } }, SEED);
  await unlock(p); return { ctx, p };
}
const raw = (p, id) => p.evaluate(async id => { const a = await Vault.loadAll(); const l = Array.isArray(a) ? a : (a.encs || Object.values(a)); return JSON.stringify(l.find(x => x && x.id === id)); }, id);
const shape = async (p, id) => { const e = JSON.parse(await raw(p, id)); return JSON.stringify({ codes: (e.codes || []).map(c => [String(c.c || '').replace(/\s+/g, ''), c.dx || '']), dx: e.dx || '', dxx: e.dxx || [] }); };
const E = (codes, dx, dxx) => JSON.stringify({ codes, dx: dx || '', dxx: dxx || [] });
async function typeDx(p, id, text) { await p.click(DX(id)); await p.keyboard.press('Control+a'); if (text) await p.keyboard.type(text); else await p.keyboard.press('Delete'); await p.keyboard.press('Tab'); await p.waitForTimeout(1500); }
const CASES = [
  ['r4', 'untouched Dx cell (focus + Tab)', null, null],
  ['r4', 'Dx cell "218, 568.0": ICD-only line and 80.19B keep 218, 568.0 is an extra', '218, 568.0', E([['', '218'], ['80.19B', '218']], '', ['568.0'])],
  ['r8', 'Dx cell reordered "568.0, 218": every line keeps its own Dx', '568.0, 218', E([['', '218'], ['80.19B', ''], ['66.4A', '568.0']])],
  ['r9', 'Dx cell reordered "568.0, 218" (normal row): matched by code, not position', '568.0, 218', E([['80.19B', '218'], ['66.4A', '568.0']])],
  ['r8', 'Dx cell "218, 568.0, V22.2": new Dx goes beside 80.19B (no Dx), others unchanged', '218, 568.0, V22.2', E([['', '218'], ['80.19B', 'V22.2'], ['66.4A', '568.0']])],
  ['r4', 'Dx cell cleared: the ICD-only line goes with its Dx, 80.19B keeps no Dx', '', E([['80.19B', '']])],
  ['r9', 'Dx cell "V22.2, 568.0" (normal row): 218 replaced on 80.19B, 66.4A keeps 568.0', 'V22.2, 568.0', E([['80.19B', 'V22.2'], ['66.4A', '568.0']])],
];
(async () => {
  const browser = await chromium.launch();
  for (const [id, name, text, want] of CASES) {
    const { ctx, p } = await boot(browser); const others = {}; for (const o of Object.keys(SEED)) if (o !== id) others[o] = await raw(p, o);
    const before = await raw(p, id); let err = '';
    try { if (text == null) { await p.click(DX(id)); await p.keyboard.press('Tab'); await p.waitForTimeout(800); } else await typeDx(p, id, text); } catch (e) { err = e.message.split('\n')[0]; }
    let same = true; for (const o of Object.keys(others)) if (await raw(p, o) !== others[o]) same = false;
    ok(same, `${id} | ${name}: every other row byte-identical`);
    if (want == null) { ok(await raw(p, id) === before, `${id} | ${name}: stored record byte-identical`); ok((await p.inputValue(DX(id))) === '218', `${id}: Dx cell reads "218" ("${await p.inputValue(DX(id))}")`); }
    else { const got = await shape(p, id); ok(!err && got === want, `${id} | ${name}: ${got}${err ? ' [' + err + ']' : ''}`); }
    await ctx.close();
  }
  // ruling 2: r7 (no fee code, entry-level Dx 218) + linked Fee Desk pick 66.4A+568.0
  { const { ctx, p } = await boot(browser);
    await p.click(FEE('r7')); await p.waitForTimeout(200);
    const [fd] = await Promise.all([ctx.waitForEvent('page'), p.locator('#todayList tr[data-id="r7"] .pickfd[data-kind="fee"]:not(.fdmini)').first().evaluate(b => b.click())]);
    await fd.waitForLoadState('domcontentloaded'); await fd.waitForSelector('#pickbar', { timeout: 30000 });
    const tok = (await p.evaluate(() => Vault.dev.get('bl.pick.v1'))).tok;
    await fd.evaluate(m => { new BroadcastChannel('medbilling-pick').postMessage(m); }, { type: 'pick', v: 2, ctx: tok, fee: ['66.4A'], dx: ['568.0'], dxFor: ['66.4A'], mod: [], modFor: [] });
    await fd.waitForTimeout(300); await fd.close().catch(() => {}); await p.waitForTimeout(1500);
    const got = await shape(p, 'r7'), want = E([['', '218'], ['66.4A', '568.0']]);
    ok(got === want, `r7 | linked pick 66.4A+568.0: 66.4A gets 568.0, entry-level 218 kept as ICD-only line, nothing dropped or doubled: ${got}`);
    await ctx.close(); }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
