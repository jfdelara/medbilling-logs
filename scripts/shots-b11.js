// b11 phone-fit screenshots (fake patients only). Run from /workspace/pwtest: TAG=before|after URL=... node shots-b11.js
const { chromium } = require(require.resolve('playwright', { paths: ['/workspace/pwtest'] }));
const URL0 = process.env.URL || 'http://127.0.0.1:18893/medbilling-logs/', PIN = '48203917', TAG = process.env.TAG || 'after';
const OUT = '/workspace/medbilling-logs/screens-b11', DAY = '2026-10-19';
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ timezoneId: 'America/Edmonton', viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date(`${DAY}T21:33:00-06:00`) });
  await p.goto(URL0); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(600);
  await p.evaluate(async day => {
    const t = (d, h) => new Date(`${d}T${h}:00-06:00`).getTime();
    const mk = (id, d, name, mrn, h, m) => { const s = t(d, h); return { id, kind: 'enc', name, mrn, chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [{ c: '03.03A', k: '03.03A', d: '', j: 'AB', f: '', dx: '780' }], facNo: '88001', fcen: 'EMRG', notes: [], segs: [{ s, e: s + m * 60000 }], status: 'done', photos: [], links: [], created: s, at: s, updated: s }; };
    const R = [['Testpatient, Alice', '900000001', '17:05', 25], ['Sample, Bob', '900000002', '17:40', 18], ['Fakename, Carol', '900000003', '18:20', 32], ['Demo, Dan', '900000004', '19:05', 15], ['Mock, Eve', '900000005', '19:40', 22], ['Dummy, Frank', '900000006', '20:15', 28]];
    const SX = ['F', 'M', 'X', 'U', '', ''];   // b11 Sex column: four filled, two left blank (banner warns)
    for (const [i, r] of R.entries()) { const e = mk('t' + i, day, ...r); if (SX[i]) e.ma = { sex: SX[i] }; await Vault.save(e); }
    await Vault.save(mk('old1', '2026-10-08', 'Oldtest, Olga', '900000099', '10:00', 20));   // an older finished, unapproved claim
    const st = await Vault.loadSettings(); st.crOnb = true; await Vault.saveSettings(st);
  }, DAY);
  await p.reload(); await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(900);
  for (let k = 0; k < 3; k++) { const o = await p.$('.cro-overlay'); if (!o) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(800);
  const shot = async n => { const f = `${OUT}/${TAG}-${n}.png`; await p.screenshot({ path: f }); console.log(f); };
  await shot('1-today');
  const dims = await p.evaluate(() => { const t = document.querySelector('#todayList table.grid'), tb = document.querySelector('.tabs'); const r = s => { const td = document.querySelector(`#todayList tr[data-id] td.c-${s}`); return td ? Math.round(td.getBoundingClientRect().right) : null; }; return { vw: innerWidth, tableW: t && t.offsetWidth, outRight: r('tout'), tabsScroll: tb && tb.scrollWidth, tabsW: tb && tb.clientWidth, rowH: (document.querySelector('#todayList tr[data-id]') || {}).offsetHeight, fs: getComputedStyle(document.querySelector('#todayList table.grid')).fontSize, cols: Object.fromEntries([...document.querySelectorAll('#todayList table.grid col')].map(c => [c.className.replace('c-',''), Math.round(c.getBoundingClientRect().width || parseFloat(getComputedStyle(c).width))])) }; });
  console.log('DIMS', JSON.stringify(dims));
  if (TAG === 'after') {
    await p.click('#ptSearchBtn'); await p.fill('#ptQ', '90000000'); await p.waitForTimeout(400); await shot('2-search-mrn');
    await p.fill('#ptQ', 'olga'); await p.waitForTimeout(400); await shot('3-search-history');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.click('#todayList tr[data-blank] .rscan.first'); await p.waitForSelector('#scanDlg[open]');
    await p.evaluate(() => { const r = MBScan.parse('FAKE TEST CARD - NOT REAL\nTESTSCAN, GRACE\nPHN 90000-0042\nSEX: F'); document.getElementById('scan_n').value = r.name; document.getElementById('scan_s').value = r.sex; document.getElementById('scan_u').value = r.uli; document.querySelector('#scanDlg [data-st]').textContent = 'Found: ' + r.found.join(', ') + '. Please check. (simulated scan of fake test text)'; });
    await shot('5-scan-confirm'); await p.click('#scanDlg [data-ok]'); await p.waitForSelector('#ewDlg[open]'); await p.waitForTimeout(600); await shot('6-scan-entry-window'); await p.click('#ewCancel'); await p.waitForTimeout(400);
    // b11: tap an empty patient cell → Scan with camera / Type it
    const nm = '#todayList tr[data-blank]:not([data-light]) td.c-name .gc';
    await p.tap(nm); await p.waitForSelector('.scanmenu'); await shot('7-scan-menu');
    console.log('CHECK menu-on-empty', !!(await p.$('.scanmenu')));
    await p.tap('.scanmenu [data-m="type"]'); await p.waitForTimeout(300);
    console.log('CHECK type-focuses', await p.evaluate(s => document.activeElement === document.querySelector(s), nm), 'menu-gone', !(await p.$('.scanmenu')));
    await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(300);
    await p.tap('#todayList tr[data-blank]:not([data-light]) td.c-mrn .gc'); await p.waitForSelector('.scanmenu'); await p.tap('.scanmenu [data-m="scan"]');
    console.log('CHECK scan-opens-sheet', !!(await p.waitForSelector('#scanDlg[open]', { timeout: 3000 }).catch(() => null))); await p.click('#scanDlg [data-x]'); await p.waitForTimeout(300);
    await p.tap('#todayList tr[data-id="t0"] td.c-name .gc'); await p.waitForTimeout(300);
    console.log('CHECK filled-no-menu', !(await p.$('.scanmenu')));
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(300);
    // b11 Sex column: values on screen, empty cell on touch → scan / type menu → M F X U pick, synced with the entry window
    const hideToast = () => p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); });
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); const g = document.querySelector('#todayList .gwrap') || document.querySelector('#todayList'); g.scrollLeft = 0; }); await p.waitForTimeout(2600); await hideToast();
    const fit = await p.evaluate(() => { const r = s => { const td = document.querySelector(`#todayList tr[data-id] td.c-${s}`); return td ? Math.round(td.getBoundingClientRect().right) : null; }; return { vw: innerWidth, name: r('name'), sex: r('sex'), mrn: r('mrn'), hc: r('hc'), tin: r('tin'), tout: r('tout'), sexW: Math.round(document.querySelector('#todayList tr[data-id] td.c-sex').getBoundingClientRect().width), vals: [...document.querySelectorAll('#todayList tr[data-id] .gc.sx')].map(b => b.textContent), banner: (document.querySelector('#clmBar .clmshort') || {}).textContent }; });
    console.log('SEXFIT', JSON.stringify(fit));
    await shot('8-sex-column');
    await p.tap('#todayList tr[data-id="t4"] td.c-sex .gc'); await p.waitForSelector('.scanmenu'); console.log('CHECK sex-empty-menu', !!(await p.$('.scanmenu [data-m="scan"]')));
    await p.tap('.scanmenu [data-m="type"]'); await p.waitForSelector('.scanmenu.sexpick'); await hideToast(); await shot('9-sex-pick');
    await p.tap('.sexpick [data-sx="M"]'); await p.waitForTimeout(700);
    console.log('CHECK sex-picked', await p.evaluate(() => document.querySelector('#todayList tr[data-id="t4"] .gc.sx').textContent));
    await p.tap('#todayList tr[data-id="t0"] td.c-sex .gc'); await p.waitForTimeout(200); console.log('CHECK filled-opens-pick', !!(await p.$('.scanmenu.sexpick')));
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('#todayList tr[data-id="t4"] .rew').click()); await p.waitForSelector('#ewDlg[open]'); await p.waitForTimeout(300);
    console.log('CHECK ew-sex-synced', await p.evaluate(() => document.getElementById('ew_sex').value));
    await p.selectOption('#ew_sex', 'U'); await p.click('#ewSave'); await p.waitForTimeout(800);
    console.log('CHECK ew-save-to-grid', await p.evaluate(() => document.querySelector('#todayList tr[data-id="t4"] .gc.sx').textContent));
    await hideToast();
    await p.click('#clmBar .clmneed'); await p.waitForTimeout(600); await shot('4-banner-tap');
    // b11: tap a row NUMBER → entry window with Type / Photo/Scan at the top → simulated scan fills Name, MRN/ULI, Sex
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.evaluate(() => { const g = document.querySelector('#todayList .gwrap'); if (g) g.scrollLeft = 0; window.scrollTo(0, 0); }); await hideToast(); await p.waitForTimeout(300);
    await shot('10-before-rownum');
    const rn = '#todayList tr[data-id="t0"] th.rn'; await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), rn); await p.tap(rn); await p.waitForSelector('#ewDlg[open]'); await p.waitForTimeout(500);
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(200);
    console.log('CHECK ew-mode', await p.evaluate(() => [...document.querySelectorAll('#ewBody [data-ewm]')].map(b => b.textContent + ':' + b.getBoundingClientRect().top|0).join(' | ')));
    await shot('11-entry-full-row1');
    await p.evaluate(() => { const b = document.querySelector('#ewDlg .ewbody'); b.scrollTop = b.scrollHeight; }); await p.waitForTimeout(300); await shot('11b-entry-full-row1-bottom');
    console.log('CHECK ew-fields', await p.evaluate(() => ['ew_name','ew_sex','ew_mrn','ew_tin','ew_tout','ew_s0_c','ew_fno','ew_fcen','ew_note'].map(i => { const e = document.getElementById(i); return i.slice(3) + '=' + (e ? e.value : 'MISSING'); }).join(' ')));
    await p.evaluate(() => { document.querySelector('#ewDlg .ewbody').scrollTop = 0; });
    await p.tap('#ewBody [data-ewm="scan"]'); await p.waitForSelector('#scanDlg[open]');
    await shot('11c-photo-scan-sheet');
    await p.evaluate(() => { const r = MBScan.parse('FAKE TEST CARD - NOT REAL\nTESTSCAN, HENRY\nPHN 90000-0077\nSEX: M'); document.getElementById('scan_n').value = r.name; document.getElementById('scan_s').value = r.sex; document.getElementById('scan_u').value = r.uli; });
    await p.click('#scanDlg [data-ok]'); await p.waitForTimeout(500);
    console.log('CHECK ew-scan-fill', await p.evaluate(() => ['ew_name', 'ew_mrn', 'ew_sex'].map(i => document.getElementById(i).value).join(' / ')), 'ew-still-open', await p.evaluate(() => document.getElementById('ewDlg').open));
    await shot('12-entry-after-scan');
  }
  console.log('ERRS', JSON.stringify(errs)); await br.close();
})();
