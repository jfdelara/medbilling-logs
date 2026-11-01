// v9x: Approve/Submit → "Queued for H-Link" (test build, nothing sent), Thursday 4:00 PM approval cutoff (3:59 vs 4:00),
// roll-over note, staff seats (default off, audit-logged, hidden billings), N key, Tab order (Referring provider → Facility #),
// nothing in plaintext localStorage, Thursday report. Pure cutoff / DST / holiday logic: tests/claims-cutoff.test.js.
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18893/medbilling-logs/ node /workspace/medbilling-logs/tests/billing-approve-v9x.test.js
const { chromium, webkit } = require('./helpers/cr-welcome');
const URL0 = process.env.URL || 'http://127.0.0.1:18893/medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const DAY = '2026-10-22';   // a Thursday (MDT)
const seed = async p => p.evaluate(async day => {
  const t = h => new Date(`${day}T${h}:00-06:00`).getTime();
  const mk = (id, name, mrn, h, extra) => Object.assign({ id, kind: 'enc', name, mrn, chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [{ c: '03.03A', k: '03.03A', d: '', j: 'AB', f: '', dx: '780' }], facNo: '88001', fcen: 'EMRG', notes: [], segs: [{ s: t(h), e: t(h) + 20 * 60000 }], status: 'done', photos: [], links: [], created: t(h), at: t(h), updated: t(h) }, extra || {});
  await Vault.save(mk('eA', 'Alpha, Ann', '123456789', '08:00', { refNm: 'Smith, Anna', refId: '123456789' }));
  await Vault.save(mk('eB', 'Bravo, Ben', '223456789', '09:00'));
  await Vault.save(mk('eC', 'Charlie, Cy', '323456789', '10:00', { codes: [{ c: '03.03A', k: '03.03A', d: '', j: 'AB', f: '' }] }));
  await Vault.save(mk('eD', 'Delta, Dee', '', '11:00'));
}, DAY);
const claimOf = (p, id) => p.evaluate(async id => { const e = (await Vault.loadAll()).find(x => x.id === id); return e && e.claim || null; }, id);
(async () => {
  for (const [L, bt] of [['chromium', chromium], ['webkit', webkit]]) {
    const br = await bt.launch(), ctx = await br.newContext({ timezoneId: 'America/Edmonton', viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(`${DAY}T15:58:30-06:00`) });
    await p.goto(URL0); await p.waitForSelector('#setupForm:not([hidden])');
    await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(600);
    const unlock = async () => { await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn'); await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(700); };
    await p.evaluate(() => { const c = document.querySelector('.cro-overlay .cro-skip, .cro-overlay [data-act="skip"]'); if (c) c.click(); });
    await seed(p); await p.reload(); await unlock();
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    // columns: Referring provider immediately before Facility #, Claim column present
    const cols = await p.$$eval('#todayList table.grid thead th[data-h]', ths => ths.map(t => t.dataset.h));
    const tds = await p.$$eval('#todayList tr[data-id="eA"] td', t => t.map(x => (x.className.match(/c-(\w+)/) || [])[1]));
    ok(tds.indexOf('ref') === tds.indexOf('fno') - 1 && /Smith, Anna/.test(await p.$eval('#todayList tr[data-id="eA"] td.c-ref', x => x.textContent + (x.querySelector('.gc') || {}).value)), `${L}: row cells: Referring provider (Smith, Anna) before Facility #`);
    ok(cols.indexOf('ref') >= 0 && cols.indexOf('ref') === cols.indexOf('fno') - 1, `${L}: Referring provider column is immediately before Facility # (${cols.join(',')})`);
    ok(cols.includes('clm'), `${L}: Claim (Approve/Submit) column present`);
    ok(await p.$$eval('#todayList tr[data-id] [data-a="apv"]', b => b.length) === 4, `${L}: Approve/Submit button on each billing row`);
    ok(/close today at 4:00 PM/i.test(await p.$eval('#clmBar', x => x.textContent)), `${L}: Thursday before 4:00 PM: batch strip says approvals close today (${await p.$eval('#clmBar', x => x.textContent)})`);
    // 3:59 PM: approve A → this week's batch, pay Fri Oct 30
    await p.clock.setSystemTime(new Date(`${DAY}T15:59:00-06:00`));
    await p.click('#todayList tr[data-id="eA"] [data-a="apv"]'); await p.waitForTimeout(700);
    let c = await claimOf(p, 'eA');
    ok(c && c.st === 'queued' && c.batch === '2026-10-22' && c.pay === '2026-10-30' && !c.rolled, `${L}: approved at 3:59 PM → Thu Oct 22 batch, pay Fri Oct 30 ${JSON.stringify(c)}`);
    ok(/Queued for H-Link/.test(await p.$eval('#todayList tr[data-id="eA"] td.c-clm', x => x.textContent)), `${L}: row shows "Queued for H-Link"`);
    // 4:00 PM: approve B → rolls to Oct 29, pay Nov 6, roll-over note
    await p.clock.setSystemTime(new Date(`${DAY}T16:00:00-06:00`));
    await p.click('#todayList tr[data-id="eB"] [data-a="apv"]'); await p.waitForTimeout(700);
    c = await claimOf(p, 'eB');
    ok(c && c.batch === '2026-10-29' && c.pay === '2026-11-06' && c.rolled === true, `${L}: approved at 4:00 PM → rolls to Thu Oct 29 batch, pay Fri Nov 6 ${JSON.stringify(c)}`);
    const bar = await p.$eval('#clmBar', x => x.textContent);
    ok(/closed at 4:00 PM/.test(bar) && /Nov 6/.test(bar), `${L}: roll-over note shows next batch week and pay date (${bar})`);
    // incomplete claims are not queued
    await p.click('#todayList tr[data-id="eC"] [data-a="apv"]'); await p.waitForTimeout(500);
    ok(!(await claimOf(p, 'eC')), `${L}: claim without ICD-9 is not queued`);
    await p.click('#todayList tr[data-id="eD"] [data-a="apv"]'); await p.waitForTimeout(500);
    ok(!(await claimOf(p, 'eD')), `${L}: claim without ULI / PHN is not queued`);
    // grid Tab order: Referring provider → Facility #
    await p.click('#todayList tr[data-id="eC"] .gc[data-c="ref"]'); await p.keyboard.press('Escape'); await p.keyboard.press('Tab'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.c) === 'fno', `${L}: grid Tab from Referring provider goes to Facility #`);
    // N key opens a new entry (not when typing); entry window Tab order
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('n'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.querySelector('#ewDlg').open), `${L}: N opens a new billing entry`);
    const seq = []; await p.focus('#ew_name');
    for (let i = 0; i < 12; i++) { seq.push(await p.evaluate(() => (document.activeElement.id || '').replace(/^ew_/, ''))); await p.keyboard.press('Tab'); await p.waitForTimeout(40); if (await p.$('#ewMenu:not([hidden])')) await p.keyboard.press('Escape'); }
    ok(seq.join(',') === 'name,mrn,sex,prov,skill,ba,refNm,refId,fno,fcen,hc,loc', `${L}: entry window Tab order follows Med Access (${seq.join(',')})`);
    await p.click('#ewCancel'); await p.waitForTimeout(300); if (await p.evaluate(() => document.querySelector('#askDlg').open)) await p.click('#askOk');
    await p.waitForTimeout(300);
    await p.click('#todayList tr[data-id="eC"] .gc[data-c="note"]'); await p.keyboard.press('n'); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => document.querySelector('#ewDlg').open)), `${L}: N while in a field (sheet cell) does not open the entry window`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(!(await claimOf(p, 'eC')) && (await claimOf(p, 'eB')).st === 'queued', `${L}: earlier approvals unchanged`);
    // seats and permissions
    await p.click('[data-tab="data"]'); await p.waitForTimeout(300);
    await p.click('#seatAddStaff'); await p.fill('#ask_n', 'Maria Lopez'); await p.fill('#ask_r', 'Billing clerk'); await p.click('#askOk'); await p.waitForTimeout(500);
    const boxes = await p.$$eval('#permTab input[data-pw]', b => b.map(x => x.checked));
    ok(boxes.length === 2 && boxes.every(x => !x), `${L}: new staff seat: View and Submit default Off (${boxes})`);
    await p.selectOption('#seatSel', { label: 'Maria Lopez · Billing clerk (staff)' }); await p.waitForTimeout(600);
    await p.click('[data-tab="today"]'); await p.waitForTimeout(400);
    ok(await p.$$eval('#todayList tr[data-id]', r => r.length) === 0, `${L}: staff without View sees no billings`);
    ok(/Staff seat/.test(await p.$eval('#clmBar', x => x.textContent)), `${L}: batch strip names the staff seat`);
    await p.click('[data-tab="data"]'); await p.waitForTimeout(300);
    ok(await p.$$eval('#permTab input[data-pw]', b => b.every(x => x.disabled)), `${L}: staff seat cannot change permissions`);
    const prov = await p.$eval('#seatSel', s => s.options[0].textContent);
    await p.selectOption('#seatSel', { index: 0 }); await p.waitForSelector('#askDlg[open]'); await p.fill('#ask_p', '00000000'); await p.click('#askOk'); await p.waitForTimeout(400);
    ok(/Wrong/.test(await p.$eval('#askErr', x => x.textContent)), `${L}: switching to the provider seat needs the passcode`);
    await p.fill('#ask_p', PIN); await p.click('#askOk'); await p.waitForTimeout(600);
    ok((await p.$eval('#seatSel', s => s.selectedIndex)) === 0, `${L}: back in provider seat (${prov})`);
    await p.check('#permTab input[data-pw="submit"]'); await p.waitForTimeout(600);
    const b2 = await p.$$eval('#permTab input[data-pw]', b => b.map(x => x.checked));
    ok(b2.join() === 'true,true', `${L}: granting Submit also turns on View (${b2})`);
    await p.click('#clmLogRefresh'); await p.waitForTimeout(400);
    const log = await p.$eval('#clmLog', x => x.textContent);
    ok(/Permission/.test(log) && /Maria Lopez/.test(log) && /View off → on/.test(log) && /Submit off → on/.test(log) && /Seat added/.test(log) && /Approved/.test(log), `${L}: audit log shows who / what / when for permissions and approvals`);
    const aud = await p.evaluate(async () => (await Vault.loadAudit()).filter(r => r.action === 'perm').map(r => [r.by, typeof r.ts]));
    ok(aud.length === 1 && aud[0][0] && aud[0][1] === 'number', `${L}: permission change in the encrypted audit chain ${JSON.stringify(aud)}`);
    ok((await p.evaluate(() => Vault.verifyAudit())).ok !== false, `${L}: audit chain verifies`);
    await p.selectOption('#seatSel', { label: 'Maria Lopez · Billing clerk (staff)' }); await p.waitForTimeout(600);
    await p.click('[data-tab="today"]'); await p.waitForTimeout(400);
    ok(await p.$$eval('#todayList tr[data-id]', r => r.length) === 4, `${L}: with View, staff sees the provider's billings`);
    // Thursday report
    await p.click('[data-tab="claims"]'); await p.waitForFunction(() => /\$\d/.test((document.querySelector('#clmRep .clmt.bill b') || {}).textContent || '')); await p.waitForTimeout(300);
    const rep = await p.evaluate(() => ({ t: document.querySelector('#clmWk').textContent, tiles: [...document.querySelectorAll('#clmRep .clmt b')].map(b => b.textContent) }));
    ok(/Oct 29/.test(rep.t) && rep.tiles.slice(0, 3).join() === '1,0,0' && /^\$\d/.test(rep.tiles[4]), `${L}: Thursday report: open batch (${rep.t}) holds the rolled-over claim, tiles ${rep.tiles}`);
    await p.click('#clmPrev'); await p.waitForTimeout(400);
    const rp = await p.evaluate(() => [...document.querySelectorAll('#clmRep .clmt b')].slice(0, 3).map(b => b.textContent).join(','));
    ok(/Oct 22/.test(await p.$eval('#clmWk', x => x.textContent)) && rp === '2,0,2' && /1 queued/.test(await p.$eval('#clmRep .clmt.pay', x => x.textContent)), `${L}: Oct 22 week: done 2 (1 in this batch, 1 rolled to the next), needs approval 0, to do 2 (${rp})`);
    // changing a billing detail after approval withdraws the approval (audit-logged)
    await p.click('[data-tab="today"]'); await p.waitForTimeout(300);
    await p.dblclick('#todayList tr[data-id="eA"] .gc[data-c="dx"]'); await p.keyboard.press('Control+a'); await p.keyboard.type('781'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
    const wd = await p.evaluate(async () => [((await Vault.loadAll()).find(x => x.id === 'eA') || {}).claim || null, (await Vault.loadAudit()).filter(r => r.eid === 'eA' && /Approval withdrawn automatically/.test(r.note || '')).length, ((await Vault.loadAll()).find(x => x.id === 'eA') || {}).codes]);
    ok(!wd[0] && wd[1] === 1, `${L}: editing ICD-9 after approval withdraws it, noted in the audit log (${wd[1]} ${JSON.stringify(wd[2])})`);
    // nothing in plaintext localStorage / no page errors
    const lsk = await p.evaluate(() => Object.keys(localStorage));
    ok(lsk.length === 0, `${L}: nothing in plaintext localStorage (${lsk.join(',')})`);
    await p.reload(); await unlock();
    ok(await p.$eval('#seatSel', s => s.selectedOptions[0].textContent).then(t => /Maria/.test(t)), `${L}: seat and permissions kept (encrypted settings) across reload`);
    ok(!errs.length, `${L}: no page errors ${errs.slice(0, 3).join(' | ')}`);
    await br.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();

