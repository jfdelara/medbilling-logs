// Suite parity v1 (Logs): Favourites pane controls match Fee Desk: groups hint shown with 3+ favourites and no groups,
// ✎ chip only on rows with linked codes (as Fee Desk linkChips), + New group a pill, Export/Import small ghost buttons.
// Synthetic data only. Run: cd /workspace/pwtest && BASE=http://127.0.0.1:PORT/ node <repo>/tests/fav-pane-parity.test.js
const { chromium } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18998/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const SEED = { 'mb.skill': 'OBGY', 'mb.jur': 'AB', 'mb.favs': JSON.stringify(['H:03.04A', 'I:650', 'H:13.99BA']), 'mb.recent': JSON.stringify(['H:03.03A']),
  'mb.favlinks': JSON.stringify({ v: 1, pairs: [['H:03.04A', 'I:650']] }) };
(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 360, height: 760 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const w = vp.width, ctx = await browser.newContext({ timezoneId: 'America/Edmonton', viewport: vp }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded', '1'); } }, SEED);
    await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
    await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    await p.click('#tabs [data-tab="fav"]'); await p.waitForSelector('#favList .hit'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const h = document.querySelector('#favPane .fghint'), n = document.getElementById('favNewGrp'), e = document.getElementById('expSaved'), cs = getComputedStyle(n);
      return { hint: !!h && !h.hidden && h.offsetHeight > 0, edits: [...document.querySelectorAll('#favList .ledit')].map(x => x.dataset.favlink), pill: parseFloat(cs.borderTopLeftRadius) >= 18 && cs.backgroundColor === 'rgb(255, 255, 255)',
        exp: Math.round(e.getBoundingClientRect().height), expFs: getComputedStyle(e).fontSize }; });
    ok(r.hint, `${w}: groups hint shown (3 favourites, no groups)`);
    ok(r.edits.length === 1 && r.edits[0] === 'H:03.04A', `${w}: ✎ chip only on the linked favourite ${JSON.stringify(r.edits)}`);
    ok(r.pill, `${w}: + New group is a pill like Fee Desk`);
    ok(r.exp <= 26 && r.expFs === '12px', `${w}: Export is the small Fee Desk ghost button ${r.exp}px ${r.expFs}`);
    ok(!errs.length, `${w}: no page errors ${JSON.stringify(errs)}`);
    await ctx.close();
  }
  await browser.close(); console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
