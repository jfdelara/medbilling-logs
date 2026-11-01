// PROTOTYPE mbl-favourites-proto: Logs ★ Favourites tab = Fee Desk's shared slim favourites list (js/shared/favrow.js).
// Tab in position 2, label "Favourites"; slim one-line rows (code · short label · price · ICD-9 chip · ★ · ⋯); a tap inserts the
// fee + its linked Dx into the last touched row through pickApply2 (F5 rules: ICD-only lines kept, Dx matched by code; r7 ruling).
// Synthetic data only. Run: cd /workspace/pwtest && BASE=http://127.0.0.1:18998/ SHOTS=/workspace/mbl-fav/shots node <repo>/tests/favourites-proto.test.js
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18998/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917', SHOTS = process.env.SHOTS || '';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const FEE = id => `#todayList tr[data-id="${id}"] [data-c="fee"]`;
const SEED = { 'mb.skill': 'OBGY', 'mb.favs': JSON.stringify(['H:80.19B', 'H:13.99BA', 'I:669.7', 'H:03.04A', 'H:03.03B']),
  'mb.favlinks': JSON.stringify({ v: 1, pairs: [['H:80.19B', 'I:218'], ['H:13.99BA', 'I:650'], ['H:03.03B', 'I:642.4']] }) };
async function unlock(p) {
  if (!(await p.evaluate(() => document.body.classList.contains('locked')))) await p.click('#lockNow');
  await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(700);
}
async function boot(browser, vp) {
  const ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: vp || { width: 1280, height: 900 } }), p = await ctx.newPage();
  await ctx.addInitScript(s => { for (const k in s) localStorage.setItem(k, s[k]); }, SEED);
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(300);
  await p.evaluate(async () => { const now = Date.now(), d0 = new Date(now); d0.setHours(0, 0, 0, 0); const at = h => Math.min(d0.getTime() + h * 3600e3, now - (12 - h) * 600e3);
    const mk = (id, h, x) => Object.assign({ id, kind: 'enc', name: 'Synthetic ' + id, mrn: '', chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [], notes: [], segs: [{ s: at(h), e: at(h) + 900e3 }], status: 'done', photos: [], links: [], created: now - 9e6, updated: now - 9e6 }, x);
    await Vault.save(mk('r1', 1, {}));
    await Vault.save(mk('r4', 2, { codes: [{ c: '', k: '', d: '', j: 'AB', f: '', dx: '218' }, { c: '80.19B', k: '80.19B', d: 'Myomectomy, vaginal', j: 'AB', f: '', dx: '218', dxd: '' }] }));
    await Vault.save(mk('r7', 3, { codes: [{ c: '', k: '', d: '', j: 'AB', f: '', dx: '218' }] })); });
  await unlock(p); return { ctx, p };
}
const raw = (p, id) => p.evaluate(async id => { const a = await Vault.loadAll(); const l = Array.isArray(a) ? a : (a.encs || Object.values(a)); return l.find(x => x && x.id === id); }, id);
const sp = s => String(s).replace(/\s+/g, '');
const lines = async (p, id) => ((await raw(p, id)).codes || []).map(c => [sp(c.c), c.dx || '']);
async function pickFav(p, id, code, w, shot) {
  await p.locator(FEE(id)).scrollIntoViewIfNeeded(); await p.click(FEE(id)); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('#tabs [data-tab="fav"]'); await p.waitForSelector('#favList .hit'); await p.waitForTimeout(300);
  if (shot && SHOTS) await p.screenshot({ path: `${SHOTS}/logs-fav-pick-before-${w}.png` });
  await p.click(`#favList .hit[data-ins-fee="${code}"], #favList .hit[data-fk="I:${code}"]`);
  await p.waitForTimeout(1500);
  if (shot && SHOTS) { await p.locator(FEE(id)).scrollIntoViewIfNeeded(); await p.screenshot({ path: `${SHOTS}/logs-fav-pick-inserted-${w}.png` }); }
}
(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const w = vp.width, { ctx, p } = await boot(browser, vp);
    const tabs = await p.$$eval('#tabs button', b => b.map(x => x.dataset.tab + ':' + x.textContent.trim()));
    ok(tabs[0] === "fav:Favourites", `${w}: Favourites is tab 1 (suite parity) (${tabs.join(' | ')})`);
    await p.click('#tabs [data-tab="fav"]'); await p.waitForSelector('#favList .hit'); await p.waitForTimeout(400);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/logs-fav-tab-${w}.png` });
    const rows = await p.$$eval('#favList .hit', h => h.map(b => ({ t: [...b.children].map(c => c.textContent.trim()).join(' | '), h: Math.round(b.getBoundingClientRect().height),
      one: (() => { const ks = [b.querySelector('.ccode'), b.querySelector('.cdesc'), b.querySelector('.star')].map(e => e.getBoundingClientRect()); return ks.every(r => r.top < ks[0].bottom && r.bottom > ks[0].top); })() })));
    console.log(rows.map(r => `${r.h}px ${r.t}`).join('\n'));
    ok(rows.length === 5, `${w}: 5 synthetic favourites listed (${rows.length})`);
    ok(/^80\.19B \| Myomectomy \| \$308\.65 \| ↔218/.test(rows[0].t), `${w}: row 1 = code · short label · price · ICD-9 chip (${rows[0].t})`);
    ok(rows.every(r => r.one), `${w}: code, short label and ★ sit on one line in every row`);
    const chipVis = await p.$$eval('#favList .lchip .code', c => c.every(e => e.scrollWidth <= e.clientWidth + 1));
    ok(chipVis, `${w}: ICD-9 chip codes fully visible`);
    if (SHOTS) await p.locator('#favList').screenshot({ path: `${SHOTS}/logs-fav-slimrows-${w}.png` });
    await p.click('#tabs [data-tab="today"]'); await p.waitForTimeout(300);
    await pickFav(p, 'r1', '80.19B', w, true);
    ok(JSON.stringify(await lines(p, 'r1')) === JSON.stringify([['80.19B', '218']]), `${w}: empty row + 80.19B favourite -> 80.19B with linked Dx 218 (${JSON.stringify(await lines(p, 'r1'))})`);
    await pickFav(p, 'r4', '13.99BA', w);
    ok(JSON.stringify(await lines(p, 'r4')) === JSON.stringify([['', '218'], ['80.19B', '218'], ['13.99BA', '650']]), `${w}: ICD-only line kept, 13.99BA gets its own 650 (${JSON.stringify(await lines(p, 'r4'))})`);
    await pickFav(p, 'r7', '13.99BA', w);
    ok(JSON.stringify(await lines(p, 'r7')) === JSON.stringify([['', '218'], ['13.99BA', '650']]), `${w}: r7 ruling, no fee + entry-level Dx 218 -> [['','218'],['13.99BA','650']] (${JSON.stringify(await lines(p, 'r7'))})`);
    await pickFav(p, 'r1', '669.7', w);
    { const r = await raw(p, 'r1'); ok(JSON.stringify(await lines(p, 'r1')) === JSON.stringify([['80.19B', '218']]) && (r.dxx || []).includes('669.7'), `${w}: ICD-only favourite 669.7 adds a Dx only (extra Dx, fee lines untouched; dxx=${JSON.stringify(r.dxx)})`); }
    await p.click('#tabs [data-tab="fav"]'); await p.waitForTimeout(200);
    const before = await p.evaluate(() => [localStorage.getItem('mb.favs'), localStorage.getItem('mb.favlinks')].join('#'));
    await p.click('#favList .hit .star'); await p.waitForTimeout(200);
    ok(before === await p.evaluate(() => [localStorage.getItem('mb.favs'), localStorage.getItem('mb.favlinks')].join('#')), `${w}: stored Fee Desk favourites untouched (read-only in Logs)`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
