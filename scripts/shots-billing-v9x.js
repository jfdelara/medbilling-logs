const { chromium } = require('playwright');
const URL0 = process.env.URL, PIN = '48203917', OUT = '/workspace/artifacts/mbl-billing', DAY = '2026-10-22';
const DEV = { desktop: { viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
(async () => {
  const br = await chromium.launch();
  for (const [D, opt] of Object.entries(DEV)) {
    const ctx = await br.newContext(Object.assign({ timezoneId: 'America/Edmonton' }, opt)), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(`${DAY}T15:41:00-06:00`) });
    await p.goto(URL0); await p.waitForSelector('#setupForm:not([hidden])');
    await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(600);
    await p.evaluate(async day => {
      const t = h => new Date(`${day}T${h}:00-06:00`).getTime();
      const rows = [['Alvarez, Maria', '102938475', '08:05', 25, '03.03A', '780', 'Smith, Anna', '123456789'], ['Bennett, Paul', '203948576', '08:40', 18, '03.03A', '786', 'Nguyen, Linh', '234567891'],
        ['Chen, Wei', '304958671', '09:20', 32, '03.04A', '650', 'Smith, Anna', '123456789'], ['Dubois, Claire', '405968172', '10:05', 15, '03.03A', '', 'Okafor, Chidi', '345678912'], ['Eagle, Tom', '', '10:40', 22, '03.03A', '462', '', ''], ['Fraser, Ian', '506978273', '11:15', 28, '03.05A', '401', 'Nguyen, Linh', '234567891']];
      for (const [i, r] of rows.entries()) { const s = t(r[2]); await Vault.save({ id: 'e' + i, kind: 'enc', name: r[0], mrn: r[1], chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [Object.assign({ c: r[4], k: r[4], d: '', j: 'AB', f: '' }, r[5] ? { dx: r[5] } : {})], refNm: r[6] || undefined, refId: r[7] || undefined, facNo: '88001', fcen: 'EMRG', notes: [], segs: [{ s, e: s + r[3] * 60000 }], status: 'done', photos: [], links: [], created: s, at: s, updated: s }); }
      const st = await Vault.loadSettings(); st.favRef = [{ n: 'Smith, Anna', id: '123456789' }, { n: 'Nguyen, Linh', id: '234567891' }]; st.ewDef = { prov: 'Dr. the owner F de Lara Nieto', skill: 'GP', ba: '12345' }; st.crOnb = true; await Vault.saveSettings(st);
    }, DAY);
    await p.reload(); await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn'); await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(900);
    for (let k = 0; k < 3; k++) { const o = await p.$('.cro-overlay'); if (!o) break; const b = await p.$('.cro-overlay button:has-text("Skip"), .cro-overlay button:has-text("Later"), .cro-overlay button:has-text("Close"), .cro-overlay button:has-text("Not now")'); if (b) await b.click(); else await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    const shot = async (n, sel) => { await p.waitForTimeout(350); const f = `${OUT}/${D}-${n}.png`; if (sel) await (await p.$(sel)).screenshot({ path: f }); else await p.screenshot({ path: f }); console.log(f); };
    const scrollGridTo = c => p.evaluate(c => { const td = document.querySelector(`#todayList tr[data-id] td.c-${c}`); const w = td && td.closest('.gwrap, .gridbox'); if (td) { let s = td.parentElement; while (s && s.scrollWidth <= s.clientWidth + 1) s = s.parentElement; if (s) s.scrollLeft = c === 'clm' ? td.offsetLeft + td.offsetWidth + 40 - s.clientWidth : Math.max(0, td.offsetLeft - 60); } }, c);
    await p.click('#todayList tr[data-id="e0"] [data-a="apv"]'); await p.waitForTimeout(700);
    await p.click('#todayList tr[data-id="e2"] [data-a="apv"]'); await p.waitForTimeout(700);
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.mouse.move(5, 5);
    if (D === 'phone') await scrollGridTo('ref');
    await p.waitForSelector('.snack, #snack', { state: 'hidden', timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(4500);
    await shot('1-today-approve-submit');
    if (D === 'phone') { await scrollGridTo('clm'); await shot('1b-today-claim-column'); await scrollGridTo('ref'); }
    // after the 4:00 PM cutoff
    await p.clock.setSystemTime(new Date(`${DAY}T16:07:00-06:00`));
    await p.click('#todayList tr[data-id="e1"] [data-a="apv"]'); await p.waitForTimeout(5200);
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.mouse.move(5, 5);
    if (D === 'phone') { await scrollGridTo('ref'); await p.click('#clmBar'); await p.waitForTimeout(300); }   // phone: tap the one-line strip for the full roll-over note
    await shot('2-after-cutoff-rollover');
    if (D === 'phone') { await scrollGridTo('clm'); await shot('2b-after-cutoff-claim-column'); await scrollGridTo('ref'); }
    await p.waitForTimeout(5000);
    // referring provider picker (▾ on the sheet, Referring provider column before Facility #)
    await p.evaluate(() => document.querySelector('#todayList tr[data-id="e3"] .refpk').click()); await p.waitForSelector('#refDlg[open]'); await p.fill('#refQ', ''); await p.waitForTimeout(300);
    await shot('6-referring-provider-picker');
    await p.click('#refClose');
    // entry window with Approve/Submit
    await p.evaluate(() => document.querySelector('#todayList tr[data-id="e5"] [data-a="ew"]').click()); await p.waitForSelector('#ewDlg[open]'); await p.waitForTimeout(500);
    await p.focus('#ew_refNm');
    await shot('7-entry-window-approve');
    await p.click('#ewCancel'); await p.waitForTimeout(300);
    // settings: staff seats and permissions
    await p.click('[data-tab="data"]'); await p.waitForTimeout(300);
    for (const [n, r] of [['Maria Lopez', 'Billing clerk'], ['Sam Patel', 'Unit clerk']]) { await p.click('#seatAddStaff'); await p.fill('#ask_n', n); await p.fill('#ask_r', r); await p.click('#askOk'); await p.waitForTimeout(500); }
    await p.check('#permTab tbody tr:nth-child(1) input[data-pw="submit"]'); await p.waitForTimeout(500);
    await p.check('#permTab tbody tr:nth-child(2) input[data-pw="view"]'); await p.waitForTimeout(500);
    { const y = await p.$eval('#seatCard', x => x.getBoundingClientRect().top + window.scrollY); const hd = await p.evaluate(() => { const t = document.querySelector('#tabs'); return t ? t.getBoundingClientRect().bottom : 100; }); await p.evaluate(v => window.scrollTo(0, v), y - hd - 12); }
    await shot('3-settings-staff-permissions');
    await p.click('#clmLogRefresh'); await p.waitForTimeout(400);
    { const y = await p.$eval('#clmLogCard', x => x.getBoundingClientRect().top + window.scrollY); const hd = await p.evaluate(() => { const t = document.querySelector('#tabs'); return t ? t.getBoundingClientRect().bottom : 100; }); await p.evaluate(v => window.scrollTo(0, v), y - hd - 12); }
    await p.$eval('#clmLog', x => { x.style.maxHeight = 'none'; });
    const vp = p.viewportSize(), need = await p.$eval('#clmLogCard', x => x.getBoundingClientRect().height);
    await p.setViewportSize({ width: vp.width, height: Math.ceil(need + 260) }); await p.waitForTimeout(400);
    { const y = await p.$eval('#clmLogCard', x => x.getBoundingClientRect().top + window.scrollY); const hd = await p.evaluate(() => document.querySelector('#tabs').getBoundingClientRect().bottom); await p.evaluate(v => window.scrollTo(0, v), y - hd - 12); }
    await shot('4-audit-log');
    await p.$eval('#clmLog', x => { x.style.maxHeight = ''; }); await p.setViewportSize(vp);
    // Thursday report: this week's batch (Oct 22) and the open batch (Oct 29)
    await p.click('[data-tab="claims"]'); await p.waitForFunction(() => /\$\d/.test((document.querySelector('#clmRep .clmt.bill b') || {}).textContent || ''));
    await p.click('#clmPrev'); await p.waitForTimeout(500); await p.evaluate(() => window.scrollTo(0, 0));
    await shot('5-thursday-report');
    if (D === 'phone') { await p.evaluate(() => window.scrollTo(0, 560)); await shot('5b-thursday-report-lists'); }
    console.log(D, 'errors:', errs.join(' | ') || 'none');
    await ctx.close();
  }
  await br.close();
})();
