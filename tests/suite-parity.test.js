// Suite parity v1 (MedBilling Logs): shared bottom tab bar (Favourites first), shared Favourites pane + Manage deep link,
// labelled always-visible "Fee Desk" button, shared Settings block, backup carries Fee Desk favourites, shared top toast,
// SW cache bump. Synthetic data only. Run: cd /workspace/pwtest && BASE=http://127.0.0.1:PORT/ node <repo>/tests/suite-parity.test.js
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18998/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const SEED = { 'mb.skill': 'OBGY', 'mb.jur': 'AB', 'mb.favs': JSON.stringify(['H:80.19B', 'H:13.99BA', 'I:669.7']), 'mb.recent': JSON.stringify(['H:03.03A']),
  'mb.favlinks': JSON.stringify({ v: 1, pairs: [['H:80.19B', 'I:218'], ['H:13.99BA', 'I:650']] }), 'mb.favgroups': JSON.stringify({ v: 1, groups: [{ id: 'g1', name: 'Synthetic group', keys: ['H:13.99BA'] }] }) };
async function boot(browser, vp) {
  const ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: vp }), p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.errs = errs;
  await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded', '1'); } }, SEED);
  await ctx.addInitScript(() => { window.__opened = []; window.open = (u, n) => { window.__opened.push([String(u), n]); return {}; }; });
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('tabs')).display === 'none'), `${vp.width}: tab bar hidden while locked / at setup`);
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(500);
  return { ctx, p };
}
(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 360, height: 760 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const w = vp.width, { ctx, p } = await boot(browser, vp);
    const bar = await p.evaluate(() => { const t = document.getElementById('tabs'), r = t.getBoundingClientRect();
      return { cls: t.className, pos: getComputedStyle(t).position, bottom: Math.round(innerHeight - r.bottom), tabs: [...t.querySelectorAll('button')].map(x => x.dataset.tab), icons: [...t.querySelectorAll('button')].every(x => x.querySelector('svg')),
        favFull: (s => !!s && s.scrollWidth <= s.clientWidth + 1 && s.textContent.trim() === 'Favourites')(t.querySelector('[data-tab="fav"] span') || t.querySelector('[data-tab="fav"]')) }; });
    ok(/sptabs/.test(bar.cls) && bar.pos === 'fixed' && bar.bottom === 0, `${w}: one shared bottom icon tab bar ${JSON.stringify(bar)}`);
    ok(bar.tabs[0] === 'fav' && bar.tabs[bar.tabs.length - 1] === 'data' && bar.icons, `${w}: Favourites first, Settings last (${bar.tabs})`);
    ok(bar.favFull, `${w}: 'Favourites' label shown in full`);
    const fd = await p.evaluate(() => { const b = document.querySelector('#todayList td.c-fee .spfd'); if (!b) return null; const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
      return { text: b.textContent.trim(), vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0 && r.width > 0, hov: b.classList.contains('hov') }; });
    ok(fd && fd.text === 'Fee Desk' && fd.vis && !fd.hov, `${w}: labelled 'Fee Desk' button always visible on rows ${JSON.stringify(fd)}`);
    const gridOk = await p.evaluate(() => { const g = document.querySelector('#todayList .gwrap'), t = document.getElementById('tabs'); return !g || g.getBoundingClientRect().bottom <= t.getBoundingClientRect().top + 1 || [Math.round(g.getBoundingClientRect().bottom), Math.round(t.getBoundingClientRect().top), g.style.height]; });
    if (gridOk !== true) console.log('grid', JSON.stringify(gridOk), JSON.stringify(await p.evaluate(() => { const g = document.querySelector('#todayList .gwrap'), t = document.getElementById('tabs'); return { top: g.getBoundingClientRect().top, sy: scrollY, ih: innerHeight, tb: t.offsetHeight, pos: getComputedStyle(t).position, gs: g.style.height, n: document.querySelectorAll('#todayList .gwrap').length }; })));
    ok(gridOk === true, `${w}: Today grid ends above the tab bar`);
    await p.click('#tabs [data-tab="fav"]'); await p.waitForSelector('#favList .hit'); await p.waitForTimeout(300);
    const pane = await p.evaluate(() => ({ head: document.querySelector('#savedFav h3').textContent, manage: !!document.querySelector('#savedFav #favManage'), rows: document.querySelectorAll('#favList .hit').length,
      groups: [...document.querySelectorAll('#favList .fgname')].map(h => h.textContent), recent: document.querySelectorAll('#favRecent .hit').length, h: Math.max(...[...document.querySelectorAll('#favList .hit')].map(h => h.getBoundingClientRect().height)) }));
    ok(pane.head === '★ Favourites' && pane.manage && pane.rows === 3 && pane.h <= 64, `${w}: shared Favourites pane: slim rows + Manage ${JSON.stringify(pane)}`);
    { const of = await p.evaluate(() => { const P = document.querySelector('#favPane'), pr = P.getBoundingClientRect(); return [...P.querySelectorAll('.hit, .hit *')].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect()).filter(r => r.right > pr.right + 0.5 || r.right > innerWidth + 0.5).length; });
      ok(of === 0, `${w}: no favourite row content past the pane / screen edge (${of})`); }
    ok(pane.groups.join('|') === 'Synthetic group|Ungrouped' && pane.recent === 1, `${w}: Fee Desk groups (read-only headings) and Recent shown`);
    await p.click('#favManage'); await p.click('#favList .star');
    const op = await p.evaluate(() => window.__opened);
    ok(op.length === 2 && /feedesk\/#\/favmanage$/.test(op[0][0]) && /#\/fav\/unstar\/[HI]%3A[0-9.A-Z]+$/.test(op[1][0]) && op.every(o => o[1] === 'mbfeedesk'), `${w}: Manage and ★ deep-link into Fee Desk ${JSON.stringify(op)}`);
    await p.click('#favList .hit'); await p.waitForTimeout(200);
    const t = await p.evaluate(() => { const e = document.getElementById('toast'), r = e.getBoundingClientRect(); return { top: Math.round(r.top), cls: e.className, text: e.textContent, hidden: e.hidden }; });
    ok(t.top === 0 && /sptoast/.test(t.cls) && !t.hidden && /Tap a row on Today first/.test(t.text), `${w}: no row picked -> one shared toast at the top ${JSON.stringify(t)}`);
    await p.click('#tabs [data-tab="data"]'); await p.waitForTimeout(300);
    const set = await p.evaluate(() => ({ prov: document.querySelector('#spProv').textContent, spec: document.querySelector('#spSkill').textContent, labels: [...document.querySelectorAll('#spSettings .sprow>label')].map(l => l.textContent) }));
    ok(set.prov === 'Alberta' && set.spec === 'OBGY' && set.labels.join('|') === 'Province|Specialty|Text size|Backup|Your data', `${w}: shared Settings block (from Fee Desk storage) ${JSON.stringify(set)}`);
    if (w === 390) {
      const bk = await p.evaluate(async pin => { const f = await Vault.backup(pin); const d = await Vault.openBackup(f, pin); return { fav: d.fdfav && d.fdfav['mb.favs'], v: f.version, kind: f.kind, plain: JSON.stringify(f).includes('80.19B') }; }, PIN);
      ok(bk.v === 1 && bk.kind === 'encrypted-backup' && /80\.19B/.test(bk.fav || '') && !bk.plain, `390: encrypted backup carries Fee Desk favourites (format unchanged, not plaintext) ${JSON.stringify(bk)}`);
      const r = await p.evaluate(() => { const snap = { 'mb.favs': '["H:03.04A"]', 'mb.skill': 'GP' }; window.MBSuite.favRestore(localStorage, snap); return [localStorage.getItem('mb.favs'), localStorage.getItem('mb.skill')]; });
      ok(/80\.19B/.test(r[0]) && r[1] === 'OBGY', `390: restore never overwrites favourites already on this device ${JSON.stringify(r)}`);
      const sw = await (await p.request.get(LOGS + 'sw.js')).text(); const v = (sw.match(/const V = '([^']+)'/) || [])[1];
      ok(/suite-parity-v1|move-prep|url-switch/.test(v || '') && /js\/shared\/suite\.js/.test(sw) && /css\/shared\/suite\.css/.test(sw), `SW cache bumped: ${v}`);
    }
    ok(!p.errs.length, `${w}: no page errors ${JSON.stringify(p.errs)}`);
    await ctx.close();
  }
  await browser.close(); console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
