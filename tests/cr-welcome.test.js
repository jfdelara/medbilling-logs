// Clinical Resources welcome (first-run onboarding) as the older browser tests now meet it: shown once after the first
// unlock, blocks the grid until dismissed, "Skip – use defaults" closes it and it stays closed after reload + unlock.
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18792/medbilling-logs/ node /workspace/medbilling-logs/tests/cr-welcome.test.js
const { chromium, webkit, dismissCrWelcome } = require('./helpers/cr-welcome');
const URL0 = process.env.URL || 'http://127.0.0.1:18792/medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  for (const [L, bt] of [['chromium', chromium], ['webkit', webkit]]) {
    const br = await bt.launch(), errs = [];
    const ctx = await br.newContext({ keepCrWelcome: true, timezoneId: 'America/Edmonton', viewport: { width: 1280, height: 800 } }), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL0); await p.waitForSelector('#setupForm:not([hidden])');
    ok(!(await p.$('.cro-overlay')), `${L}: no welcome over the setup / lock screen`);
    await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked'));
    await p.waitForSelector('.cro-overlay', { timeout: 5000 }).catch(() => {});
    ok(/Welcome! Set up your defaults/.test(await p.textContent('.cro-overlay h2').catch(() => '')), `${L}: welcome shown after first unlock`);
    ok(await p.evaluate(() => { const r = document.querySelector('#todayList').getBoundingClientRect(); const el = document.elementFromPoint(r.left + 20, r.top + 20); return !!(el && el.closest('.cro-overlay')); }), `${L}: welcome covers the grid until dismissed`);
    await dismissCrWelcome(p);
    ok(!(await p.$('.cro-overlay')), `${L}: Skip closes the welcome`);
    await p.waitForTimeout(800);   // let the skip reach the encrypted settings before reloading
    await p.reload(); await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(1200);
    ok(!(await p.$('.cro-overlay')), `${L}: after a skip, reload + unlock does not show the welcome again`);
    // helper default (no keepCrWelcome): the welcome is skipped automatically
    const c2 = await br.newContext({ timezoneId: 'America/Edmonton' }), p2 = await c2.newPage();
    await p2.goto(URL0); await p2.waitForSelector('#setupForm:not([hidden])');
    await p2.check('input[name=sKind][value=pin]'); await p2.fill('#sPass', PIN); await p2.fill('#sPass2', PIN); await p2.check('#sAck'); await p2.check('#sResp'); await p2.click('#sBtn');
    await p2.waitForFunction(() => !document.body.classList.contains('locked')); await p2.waitForTimeout(1200);
    ok(!(await p2.$('.cro-overlay')), `${L}: shared helper auto-skips the welcome`);
    ok(!errs.length, `${L}: no page errors ${errs.join(' | ')}`);
    await br.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL exception: ' + e.message); process.exit(1); });
