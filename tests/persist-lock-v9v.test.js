// v9v: auto-lock default 10 min (old 2-min default moved up, a chosen value kept), no lock on tab / app switch,
// lock on return after a long suspension, preferences kept across lock / reload / next day, persistent storage requested.
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18792/medbilling-logs/ node /workspace/medbilling-logs/tests/persist-lock-v9v.test.js
const fs = require('fs'), path = require('path');
const { chromium, webkit } = require('./helpers/cr-welcome');
const URL0 = process.env.URL || 'http://127.0.0.1:18792/medbilling-logs/', PIN = '48203917', OUT = process.env.OUT || '/workspace/artifacts/mbl-popup';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const esc1 = async p => { if (await p.$('#ewMenu:not([hidden])')) await p.keyboard.press('Escape'); };
const locked = p => p.evaluate(() => document.body.classList.contains('locked'));
const hide = (p, on) => p.evaluate(on => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => on }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => on ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); if (on) window.dispatchEvent(new Event('blur')); else window.dispatchEvent(new Event('focus')); }, on);
(async () => {
  for (const [L, bt] of [['chromium', chromium], ['webkit', webkit]]) {
    const br = await bt.launch(), ctx = await br.newContext({ timezoneId: 'America/Edmonton', viewport: { width: 1280, height: 800 } }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-10-14T09:00:00-06:00') });
    await p.goto(URL0); await p.waitForSelector('#setupForm:not([hidden])');
    await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(800);
    const unlock = async () => { await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn'); await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(800); };
    ok(await p.$eval('#autolock', s => s.value) === '10', `${L}: auto-lock default is 10 minutes`);
    // preferences
    await p.evaluate(() => { document.querySelector('#refCol').click(); const d = document.querySelector('#defSetting'); d.value = 'C'; d.dispatchEvent(new Event('change')); });
    await p.evaluate(async () => { /* settings set through the app's own save path: favourites, window width, defaults, last facility */ });
    await p.focus('#todayList table.grid tbody tr[data-blank] .gc[data-c="name"]'); await p.keyboard.press('Control+Enter'); await p.waitForSelector('#ewDlg[open]');
    await p.fill('#ew_name', 'Test, Patient'); await p.fill('#ew_prov', 'Dr Test'); await p.waitForTimeout(150); await esc1(p); await p.fill('#ew_skill', 'GP'); await p.waitForTimeout(150); await esc1(p); await p.fill('#ew_ba', '99999'); await p.waitForTimeout(150); await esc1(p);
    await p.fill('#ew_fno', '88001'); await p.waitForTimeout(150); await esc1(p); await p.fill('#ew_fcen', 'EMRG'); await p.waitForTimeout(150); await esc1(p);
    await p.click('#ewWide'); await p.click('#ewSave'); await p.waitForFunction(() => !document.querySelector('#ewDlg').open); await p.waitForTimeout(600);
    // tab / app switch: no lock (short and 5 min away)
    await hide(p, true); await p.waitForTimeout(200); await hide(p, false); await p.waitForTimeout(200);
    ok(!(await locked(p)), `${L}: switching tabs / apps does not lock`);
    await hide(p, true); await p.clock.fastForward('05:00'); await hide(p, false); await p.waitForTimeout(300);
    ok(!(await locked(p)), `${L}: back after 5 min away: still unlocked`);
    await p.evaluate(() => document.dispatchEvent(new Event('pointerdown')));
    await hide(p, true); await p.clock.fastForward('11:00'); await hide(p, false); await p.waitForTimeout(300);
    ok(await locked(p), `${L}: back after 11 min away (suspended): locked`);
    await hide(p, false); await unlock();
    // next day: reload keeps preferences
    await p.clock.setSystemTime(new Date('2026-10-15T08:00:00-06:00')); await p.reload(); await unlock();
    const st = await p.evaluate(async () => { const s = await Vault.loadSettings(); return { refCol: s.refCol, def: s.defSetting, ewDef: s.ewDef, ewWide: s.ewWide, autolock: s.autolock, ui: [document.querySelector('#refCol').checked, document.querySelector('#defSetting').value, document.querySelector('#autolock').value] }; });
    ok(st.refCol === false && st.def === 'C' && st.ewWide === true && st.ewDef && st.ewDef.prov === 'Dr Test' && st.ewDef.skill === 'GP' && st.ewDef.ba === '99999' && st.ui.join() === 'false,C,10', `${L}: next-day reload keeps preferences ${JSON.stringify(st)}`);
    await p.focus('#todayList table.grid tbody tr[data-blank] .gc[data-c="name"]'); await p.keyboard.press('Control+Enter'); await p.waitForSelector('#ewDlg[open]');
    const nv = await p.evaluate(() => ['prov', 'skill', 'ba'].map(k => document.querySelector('#ew_' + k).value).concat([document.querySelector('#ewDlg').classList.contains('wide')]));
    ok(nv.join() === 'Dr Test,GP,99999,true', `${L}: new day, new entry: billing physician, skill, BA and wide window remembered (${nv.join()})`);
    await p.fill('#ew_name', 'Second, Test'); await p.click('#ewSave'); await p.waitForFunction(() => !document.querySelector('#ewDlg').open); await p.waitForTimeout(600);
    const fc = await p.evaluate(() => { const e = window.__dbgLast; return [...document.querySelectorAll('#todayList table.grid tbody tr')].map(tr => [tr.querySelector('.gc[data-c="name"]'), tr.querySelector('.gc[data-c="fno"]'), tr.querySelector('.gc[data-c="fcen"]')]).filter(x => x[0] && x[0].value === 'Second, Test').map(x => [x[1] && (x[1].value || x[1].dataset.v || x[1].textContent), x[2] && (x[2].value || x[2].dataset.v || x[2].textContent)])[0]; });
    ok(fc && /88001/.test(fc[0]) && /EMRG/.test(fc[1]), `${L}: new day: last Facility # and Functional centre carried down (${fc})`);
    // migration: an old vault with the old 2-minute default moves to 10; a chosen value stays
    await p.evaluate(async () => { const s = await Vault.loadSettings(); s.autolock = 2; delete s.autolockSet; await Vault.saveSettings(s); }); await p.reload(); await unlock();
    ok(await p.$eval('#autolock', s => s.value) === '10', `${L}: old 2-minute default becomes 10`);
    await p.evaluate(() => { const a = document.querySelector('#autolock'); a.value = '2'; a.dispatchEvent(new Event('change')); }); await p.waitForTimeout(300); await p.reload(); await unlock();
    ok(await p.$eval('#autolock', s => s.value) === '2', `${L}: an explicitly chosen 2 minutes is kept`);
    ok(/Storage:/.test(await p.$eval('#persistInfo', x => x.textContent)), `${L}: persistent storage requested (${await p.$eval('#persistInfo', x => x.textContent)})`);
    // encrypted data intact
    ok((await p.evaluate(async () => (await Vault.loadAll()).filter(e => e.kind === 'enc').length)) === 2, `${L}: encrypted entries intact`);
    if (L === 'chromium') { await p.evaluate(() => { const s = document.querySelector('#autolock'); s.scrollIntoView({ block: 'center' }); }); }
    ok(!errs.length, `${L}: no page errors ${errs.slice(0, 3).join(' | ')}`);
    await br.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
