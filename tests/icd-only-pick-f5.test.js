// MBL-F5 regression (Addendum 3): rows with an ICD-only line ({c:'', dx:'218'}) through every Fee code(s) path: grid edit,
// untouched, Fee Desk v1 fee, v2 single fee, v2 linked fee+ICD, v2 multi (2 fee + 1 ICD), and the real Fee Desk ＋ tray.
// The ICD-only line is kept and every Dx stays with its own code (matched by code / link, never by position); "added" is
// counted by code. Normal rows (r1, r5, r7) must come out exactly as on c286169: compared with tests/f5-normal-golden.json
// (recorded on c286169; GOLDEN_WRITE=1 re-records). Synthetic data only.
// Run: cd /workspace/pwtest && BASE=http://127.0.0.1:18995/ node <repo>/tests/icd-only-pick-f5.test.js
// (BASE serves this repo's public/ at /medbilling-logs/ and a Fee Desk build at /feedesk/)
const fs = require('fs'), path = require('path');
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18995/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917', GOLD = path.join(__dirname, 'f5-normal-golden.json');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const FEE = id => `#todayList tr[data-id="${id}"] [data-c="fee"]`;
const L = (c, dx) => ({ c, k: c, d: '', j: 'AB', f: '', dx, dxd: '' });
const SEED = {
  r1: { codes: [Object.assign(L('80.19B', '218'), { d: 'Myomectomy, vaginal' })] },
  r4: { codes: [{ c: '', k: '', d: '', j: 'AB', f: '', dx: '218' }, Object.assign(L('80.19B', '218'), { d: 'Myomectomy, vaginal' })] },
  r5: { codes: [L('03.03A', '')] },
  r6: { codes: [{ c: '', k: '', d: '', j: 'AB', f: '', dx: '218' }] },
  r7: { codes: [], dx: '218' },
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
    let h = 1; for (const [id, x] of Object.entries(SEED)) await Vault.save(Object.assign({ id, kind: 'enc', name: 'Synthetic ' + id, mrn: '', chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [], notes: [], segs: [{ s: at(h), e: at(h) + 900e3 }], status: 'done', photos: [], links: [], created: now - 9e6, updated: now - 9e6 }, JSON.parse(JSON.stringify(x)), { _h: h++ }) && Object.assign({ id, kind: 'enc', name: 'Synthetic ' + id, mrn: '', chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [], notes: [], segs: [{ s: at(h - 1), e: at(h - 1) + 900e3 }], status: 'done', photos: [], links: [], created: now - 9e6, updated: now - 9e6 }, JSON.parse(JSON.stringify(x)))); }, SEED);
  await unlock(p); return { ctx, p };
}
const raw = (p, id) => p.evaluate(async id => { const a = await Vault.loadAll(); const l = Array.isArray(a) ? a : (a.encs || Object.values(a)); return JSON.stringify(l.find(x => x && x.id === id)); }, id);
const sp = s => String(s || '').replace(/\s+/g, '');
const shape = async (p, id) => { const e = JSON.parse(await raw(p, id)); return { codes: (e.codes || []).map(c => [sp(c.c), c.dx || '']), dx: e.dx || '', dxx: e.dxx || [], mod1: e.mod1 || '', mod2: e.mod2 || '' }; };
async function openPick(p, id) {
  await p.click(FEE(id)); await p.waitForTimeout(200);
  const [fd] = await Promise.all([p.context().waitForEvent('page'), p.locator(`#todayList tr[data-id="${id}"] .pickfd[data-kind="fee"]:not(.fdmini)`).first().evaluate(b => b.click())]);
  await fd.waitForLoadState('domcontentloaded'); await fd.waitForSelector('#pickbar', { timeout: 30000 });
  const tok = (await p.evaluate(() => Vault.dev.get('bl.pick.v1'))).tok; return { fd, tok };
}
async function post(p, id, msg) { const { fd, tok } = await openPick(p, id); await fd.evaluate(m => { const bc = new BroadcastChannel('medbilling-pick'); bc.postMessage(m); }, msg(tok)); await fd.waitForTimeout(300); await fd.close().catch(() => {}); await p.waitForTimeout(1500); }
const fdReady = fd => fd.waitForFunction(() => document.querySelector('#results .savedh, #results .hit, #detail .codebig'), null, { timeout: 30000 });
const PATHS = {
  'untouched (focus + Tab)': async (p, id) => { await p.click(FEE(id)); await p.keyboard.press('Tab'); await p.waitForTimeout(800); },
  'grid edit: append 66.4A': async (p, id) => { await p.click(FEE(id)); await p.keyboard.press('End'); await p.keyboard.type((await p.inputValue(FEE(id))) ? ', 66.4A' : '66.4A'); await p.keyboard.press('Tab'); await p.waitForTimeout(1500); },
  'v1 fee 66.4A': (p, id) => post(p, id, t => ({ type: 'pick', code: '66.4A', kind: 'hsc', ctx: t })),
  'v2 single fee 66.4A': (p, id) => post(p, id, t => ({ type: 'pick', v: 2, ctx: t, fee: ['66.4A'], dx: [], dxFor: [], mod: [], modFor: [] })),
  'v2 linked 66.4A+568.0': (p, id) => post(p, id, t => ({ type: 'pick', v: 2, ctx: t, fee: ['66.4A'], dx: ['568.0'], dxFor: ['66.4A'], mod: [], modFor: [] })),
  'v2 multi 66.4A,86.9C + 568.0': (p, id) => post(p, id, t => ({ type: 'pick', v: 2, ctx: t, fee: ['66.4A', '86.9C'], dx: ['568.0'], dxFor: [''], mod: [], modFor: [] })),
  'v2 real ＋ tray 66.4A + V22.2': async (p, id) => { const { fd } = await openPick(p, id); await fdReady(fd);
    await fd.fill('#q', '66.4A'); await fd.press('#q', 'Enter'); await fd.waitForSelector('#results .hit[data-code="66.4A"] .psel', { timeout: 15000 }); await fd.click('#results .hit[data-code="66.4A"] .psel');
    await fd.evaluate(() => { location.hash = '#/icd9'; }); await fd.waitForTimeout(300); await fd.fill('#iq', 'V22'); await fd.press('#iq', 'Enter');
    await fd.waitForSelector('#icdresults .icdrow[data-icd="V22.2"] .psel', { timeout: 15000 }); await fd.click('#icdresults .icdrow[data-icd="V22.2"] .psel');
    const closed = fd.waitForEvent('close', { timeout: 10000 }).catch(() => null); await fd.click('#ptSend'); await closed; await p.waitForTimeout(1500); },
};
const E = (codes, extra) => Object.assign({ codes, dx: '', dxx: [], mod1: '', mod2: '' }, extra);
const EXPECT = {
  r4: { 'untouched (focus + Tab)': null, 'grid edit: append 66.4A': E([['', '218'], ['80.19B', '218'], ['66.4A', '']]), 'v1 fee 66.4A': E([['', '218'], ['80.19B', '218'], ['66.4A', '']]),
    'v2 single fee 66.4A': E([['', '218'], ['80.19B', '218'], ['66.4A', '']]), 'v2 linked 66.4A+568.0': E([['', '218'], ['80.19B', '218'], ['66.4A', '568.0']]),
    'v2 multi 66.4A,86.9C + 568.0': E([['', '218'], ['80.19B', '218'], ['66.4A', '568.0'], ['86.9C', '']]), 'v2 real ＋ tray 66.4A + V22.2': E([['', '218'], ['80.19B', '218'], ['66.4A', 'V22.2']]) },
  r6: { 'untouched (focus + Tab)': null, 'grid edit: append 66.4A': E([['', '218'], ['66.4A', '']]), 'v1 fee 66.4A': E([['', '218'], ['66.4A', '']]),
    'v2 single fee 66.4A': E([['', '218'], ['66.4A', '']]), 'v2 linked 66.4A+568.0': E([['', '218'], ['66.4A', '568.0']]),
    'v2 multi 66.4A,86.9C + 568.0': E([['', '218'], ['66.4A', '568.0'], ['86.9C', '']]), 'v2 real ＋ tray 66.4A + V22.2': E([['', '218'], ['66.4A', 'V22.2']]) },
};
const ROWS = (process.env.ROWS || 'r4,r6,r1,r5,r7').split(',');
(async () => {
  const browser = await chromium.launch(), got = {};
  for (const id of ROWS) for (const [name, fn] of Object.entries(PATHS)) {
    if (name.includes('tray') && !['r4', 'r6', 'r1'].includes(id)) continue;
    const { ctx, p } = await boot(browser); let err = '';
    const others = {}; for (const o of Object.keys(SEED)) if (o !== id) others[o] = await raw(p, o);
    const before = await raw(p, id);
    try { await fn(p, id); } catch (e) { err = e.message.split('\n')[0]; }
    const after = await shape(p, id); got[id + ' | ' + name] = after;
    const untouched = Object.keys(others).every(async () => true); let same = true; for (const o of Object.keys(others)) if (await raw(p, o) !== others[o]) same = false;
    ok(same, `${id} | ${name}: every other row byte-identical in storage`);
    if (name.startsWith('untouched')) ok(await raw(p, id) === before, `${id} | ${name}: stored record byte-identical`);
    else if (EXPECT[id]) ok(!err && JSON.stringify(after) === JSON.stringify(EXPECT[id][name]), `${id} | ${name}: ${JSON.stringify(after.codes)}${after.dxx.length ? ' dxx ' + after.dxx : ''}${err ? ' [' + err + ']' : ''}`);
    if (EXPECT[id] || name.startsWith('untouched')) { await ctx.close(); continue; }
    await ctx.close();
  }
  // normal rows: identical to the result on c286169
  const normal = Object.fromEntries(Object.entries(got).filter(([k]) => !/^r4|^r6/.test(k)));
  if (process.env.GOLDEN_WRITE) { fs.writeFileSync(GOLD, JSON.stringify(normal, null, 1) + '\n'); console.log('golden written: ' + GOLD); }
  else { const g = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
    for (const k of Object.keys(g)) if (!k.startsWith('_') && k in normal) ok(JSON.stringify(normal[k]) === JSON.stringify(g[k]), `normal row ${k}: same result as c286169 ${JSON.stringify(normal[k].codes)}${normal[k].dx ? ' dx ' + normal[k].dx : ''}${normal[k].dxx.length ? ' dxx ' + normal[k].dxx : ''}`); }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
