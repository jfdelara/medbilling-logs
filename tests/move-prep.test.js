// move-prep: Export my data / Import my data and the "This app is moving" banner (shared js/shared/move.js). Synthetic data only.
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18940/medbilling-logs/ node tests/move-prep.test.js
const path = require('path'), fs = require('fs');
const { chromium, NAME_POS } = require('./helpers/cr-welcome');
const URL = process.env.URL || 'http://127.0.0.1:18940/medbilling-logs/';
const OUT = process.env.OUT || '/workspace/artifacts/mbl-move-prep'; fs.mkdirSync(OUT, { recursive: true });
const SHOTS = process.env.SHOTS || '';
const P1 = 'Quiet harbor seventy lantern', P2 = 'Copper meadow ninety violin';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const pad = n => String(n).padStart(2, '0'), hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
async function setup(page, pass) {
  await page.goto(URL); await page.waitForSelector('#setupForm:not([hidden])');
  await page.check('input[name=sKind][value=phrase]');
  await page.fill('#sPass', pass); await page.fill('#sPass2', pass); await page.check('#sAck'); await page.check('#sResp'); await page.click('#sBtn');
  await page.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 30000 }); await page.waitForTimeout(500);
}
async function typeRow(page, r, name, mrn, mins, fee, dx) {
  const now = Date.now();
  await page.click('#tabs [data-tab=today]');
  await page.click(`#todayList table.grid tbody tr:nth-child(${r}) .gc[data-c="name"]`, NAME_POS);
  for (const v of [name, null, mrn, null, hm(now - mins * 60000), hm(now - (mins - 20) * 60000), null, null, null, fee, '', '', dx, 'synthetic']) { if (v) await page.keyboard.type(v, { delay: 3 }); await page.keyboard.press('Tab'); await page.waitForTimeout(150); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
const rows = page => page.locator('#todayList tbody tr[data-id]').count();
async function exportMine(page, pass, file) {
  await page.click('#tabs [data-tab=data]'); await page.click('#mvExport'); await page.waitForSelector('#askDlg[open]');
  ok(/same passcode/.test(await page.textContent('#askDlg')), 'b: export screen says the same passcode is needed to import');
  await page.fill('#ask_p', pass);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#askOk')]);
  await dl.saveAs(file); return { name: dl.suggestedFilename(), env: JSON.parse(fs.readFileSync(file, 'utf8')) };
}
async function openImport(page, file, pass, noWait) {
  await page.click('#tabs [data-tab=data]'); const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#mvImport')]); await fc.setFiles(file);
  if (pass) { await page.waitForSelector('#askDlg[open]'); await page.fill('#ask_p', pass); await page.click('#askOk'); }
  if (!noWait) await page.waitForSelector('#mvDlg[open]', { timeout: 30000 });
}
const cnt = (page, k) => page.textContent(`#mvCounts tr[data-k="${k}"] td`).then(Number);
async function doImport(page, mode) {
  await page.check(`input[name=mvMode][value=${mode}]`);
  if (mode === 'replace') { ok(await page.isDisabled('#mvGo'), 'replace: Import disabled until confirmed'); await page.check('#mvSure'); }
  await page.click('#mvGo'); await page.waitForSelector('#mvDlg', { state: 'hidden', timeout: 30000 }); await page.waitForTimeout(800);
}
const norm = encs => JSON.stringify(encs.map(e => { const o = Object.assign({}, e); delete o.updated; return o; }).sort((a, b) => a.id < b.id ? -1 : 1));
async function decrypt(page, env, pass) { return page.evaluate(async ([vb, p]) => { const d = await window.Vault.openBackup(vb, p); return { encs: d.encounters, photos: (d.photos || []).length, settings: d.settings }; }, [env.data.vault, pass]); }
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const mk = async (w = 1280, init) => { const c = await browser.newContext({ viewport: { width: w, height: 900 }, timezoneId: 'America/Edmonton', acceptDownloads: true }); if (init) await c.addInitScript(init); const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); return p; };
  // ---- device A: synthetic entries + Fee Desk favourites, then Export my data
  const A = await mk();
  await setup(A, P1);
  await A.evaluate(() => { localStorage.setItem('mb.favs', JSON.stringify(['03.03A', '03.04A'])); localStorage.setItem('mb.jur', 'AB'); localStorage.setItem('mb.skill', 'Family medicine'); });
  await typeRow(A, 1, 'Sample, Maria', '100357913', 200, '03.04A', 'V22.1');
  await typeRow(A, 2, 'Doe, Jane', '100987654', 150, '03.08A', '626.2');
  ok(await rows(A) === 2, 'device A: 2 synthetic entries');
  await A.click('#tabs [data-tab=data]');
  ok(await A.evaluate(() => { const r = document.querySelector('.mvrow'); const b = document.querySelector('#spBackup'); return !!r && b.closest('.sprow').nextElementSibling.nextElementSibling === r; }), 'Your data row sits right after Back up row + help (same place as Fee Desk)');
  ok(await A.textContent('.mvrow #mvExport') === 'Export my data' && await A.textContent('.mvrow #mvImport') === 'Import my data', 'button wording');
  ok(!(await A.$('#mvBanner')), 'banner OFF by default (no MOVING_TO_URL)');
  const fA = path.join(OUT, 'logs-A.json'); const ex = await exportMine(A, P1, fA);
  ok(/^medbilling-logs-my-data-\d{4}-\d\d-\d\d\.json$/.test(ex.name), 'file name ' + ex.name);
  const e = ex.env;
  ok(e.schema === 'mb-suite-data' && e.schemaVersion === 1 && e.app === 'medbilling-logs' && !isNaN(Date.parse(e.exportedAt)), 'envelope: schema, version, app id, exportedAt');
  ok(e.counts.encounters === 2 && e.counts.favourites === 2, 'counts: 2 entries, 2 favourites');
  ok(!/Sample, Maria|100357913/.test(fs.readFileSync(fA, 'utf8')), 'patient data is not plaintext in the file');
  ok(e.data.localStorage['mb.skill'] === 'Family medicine', 'Fee Desk keys carried');
  const srcA = await decrypt(A, e, P1);
  if (SHOTS) await A.screenshot({ path: path.join(SHOTS, 'logs-export-1280.png') });
  // ---- device B: merge into a device that already has its own entry
  const B = await mk();
  await setup(B, P2);
  await B.evaluate(() => localStorage.setItem('mb.favs', JSON.stringify(['13.99A'])));
  await typeRow(B, 1, 'Testova, Olga', '100555123', 100, '13.99A', '650');
  await B.click('#tabs [data-tab=data]'); { const [fc] = await Promise.all([B.waitForEvent('filechooser'), B.click('#mvImport')]); await fc.setFiles(fA); }
  await B.waitForSelector('#askDlg[open]'); const askT = await B.textContent('#askDlg');
  ok(/locked with the passcode that was used when it was exported/.test(askT) && /Passcode used when this file was exported/.test(askT), 'b: import screen says the file needs the passcode used when exporting');
  if (SHOTS) await B.screenshot({ path: path.join(SHOTS, 'logs-import-passcode-1280.png') });
  await B.click('#askCancel').catch(() => B.keyboard.press('Escape')); await B.waitForTimeout(300);
  await openImport(B, fA, 'wrong passcode here', true);
  await B.waitForFunction(() => /not the passcode this file was exported with/.test(document.querySelector('#askErr').textContent), null, { timeout: 30000 }).catch(() => {}); ok(/not the passcode this file was exported with/.test(await B.textContent('#askErr')), 'wrong file passcode shows an error');
  await B.fill('#ask_p', P1); await B.click('#askOk'); await B.waitForSelector('#mvDlg[open]', { timeout: 30000 });
  ok(await cnt(B, 'encounters') === 2 && await cnt(B, 'favourites') === 2, 'preview counts (2 entries, 2 favourites)');
  const nB = await B.$$eval('#mvNotes li', l => l.map(x => x.textContent)), aud = await B.textContent('#mvCounts tr[data-k="audit"]');
  ok(nB.some(t => /passcode used when this file was exported/.test(t)), 'b: preview notes the file passcode ' + JSON.stringify(nB));
  ok(nB.some(t => /Audit log: kept in the file as an archive only\. It is not restored/.test(t)) && /archive in the file, not restored/.test(aud), 'b: preview + row say the audit log is an archive, not restored');
  ok(await B.isVisible('#mvRepRow'), 'b: new-format file offers Replace too');
  if (SHOTS) await B.screenshot({ path: path.join(SHOTS, 'logs-import-preview-1280.png') });
  await doImport(B, 'merge');
  await B.click('#tabs [data-tab=today]');
  ok(await rows(B) === 3, 'merge: 2 imported + 1 local = 3 entries');
  ok(JSON.stringify(await B.evaluate(() => JSON.parse(localStorage.getItem('mb.favs')))) === JSON.stringify(['13.99A', '03.03A', '03.04A']), 'merge: favourites joined');
  const fB = path.join(OUT, 'logs-B.json'); const eB = (await exportMine(B, P2, fB)).env; const dB = await decrypt(B, eB, P2);
  const idsA = new Set(srcA.encs.map(x => x.id));
  ok(norm(dB.encs.filter(x => idsA.has(x.id))) === norm(srcA.encs), 'merge: zero loss (every entry identical apart from updated time)');
  // ---- device C: replace
  const C = await mk();
  await setup(C, P2);
  await C.evaluate(() => { localStorage.setItem('mb.favs', JSON.stringify(['99.99Z'])); localStorage.setItem('mb.layout', 'x'); });
  await typeRow(C, 1, 'Removed, Rita', '100444222', 100, '13.99A', '650');
  await openImport(C, fA, P1); await doImport(C, 'replace');
  await C.click('#tabs [data-tab=today]');
  ok(await rows(C) === 2, 'replace: device matches the file (2 entries)');
  ok(await C.evaluate(() => localStorage.getItem('mb.favs') === JSON.stringify(['03.03A', '03.04A']) && localStorage.getItem('mb.layout') === null), 'replace: Fee Desk keys equal the file');
  const fC = path.join(OUT, 'logs-C.json'); const dC = await decrypt(C, (await exportMine(C, P2, fC)).env, P2);
  ok(norm(dC.encs) === norm(srcA.encs), 'replace: zero loss (entries identical apart from updated time)');
  // ---- b: an older Logs backup (.mblbackup from Settings > Back up, made before Export my data) imports through Import my data
  const oldB = path.join(OUT, 'medbilling-logs-backup-old.mblbackup'); fs.writeFileSync(oldB, JSON.stringify(await A.evaluate(p => window.Vault.backup(p), P1)));
  const O = await mk(); await setup(O, P2);
  await openImport(O, oldB, P1);
  const oN = await O.$$eval('#mvNotes li', l => l.map(x => x.textContent)), oF = await O.textContent('#mvFrom');
  ok(/^Older Logs backup file/.test(oF) && oN.some(t => /Older backup file \(version 1\)/.test(t)) && await cnt(O, 'encounters') === 2, 'b: old Logs backup accepted, preview ' + JSON.stringify({ oF, oN }));
  if (SHOTS) await O.screenshot({ path: path.join(SHOTS, 'logs-import-old-backup-1280.png') });
  await doImport(O, 'merge'); await O.click('#tabs [data-tab=today]');
  ok(await rows(O) === 2, 'b: old Logs backup merged: 2 entries');
  // ---- c: Replace is all or nothing (localStorage snapshot + rollback, one IndexedDB transaction)
  const D = await mk();
  await setup(D, P2);
  await D.evaluate(() => { localStorage.setItem('mb.favs', JSON.stringify(['77.77Z'])); localStorage.setItem('mb.layout', 'keep');
    const o = Storage.prototype.setItem; let n = 0; Storage.prototype.setItem = function (k, v) { if (window.__lsFail && /^mb\./.test(k) && ++n === 2) throw new Error('QuotaExceededError (synthetic test)'); return o.call(this, k, v); };
    const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__shareTitle = this.dataset.shareTitle; return c.call(this); }; });
  await typeRow(D, 1, 'Keeper, Karl', '100111333', 100, '13.99A', '650');
  const state = p => p.evaluate(async () => { const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^mb\./.test(k)) ls[k] = localStorage.getItem(k); }
    const encs = (await window.Vault.loadAll()).map(e => e.id + ':' + (e.name || '') + ':' + (e.mrn || '')).sort();
    return JSON.stringify({ ls: Object.keys(ls).sort().map(k => [k, ls[k]]), encs, photos: (await window.Vault.photoIds()).length, audit: (await window.Vault.loadAudit()).length, rows: document.querySelectorAll('#todayList tbody tr[data-id]').length }); });
  const fD = path.join(OUT, 'logs-D.json'); await exportMine(D, P2, fD);
  ok(await D.evaluate(() => window.__shareTitle) === 'MedBilling Logs: my data', 'c: share title is "MedBilling Logs: my data" (not favourites) ' + await D.evaluate(() => window.__shareTitle));
  await D.click('#tabs [data-tab=today]'); const before = await state(D);
  const failRep = async (label, arm) => {
    await openImport(D, fA, P1); await D.evaluate(arm);
    await D.check('input[name=mvMode][value=replace]'); await D.check('#mvSure'); await D.click('#mvGo');
    await D.waitForFunction(() => /could not finish, so nothing on this device was changed/.test(document.querySelector('#mvErr').textContent), null, { timeout: 30000 }).catch(() => {});
    const m = await D.textContent('#mvErr'); ok(/could not finish, so nothing on this device was changed/.test(m), `c: ${label}: error shown "${m}"`);
    await D.evaluate(() => { window.__lsFail = false; window.Vault._testAbortAfter(-1); }); await D.click('#mvCancel'); await D.waitForTimeout(300);
    await D.click('#tabs [data-tab=today]'); const after = await state(D);
    ok(after === before, `c: ${label}: data unchanged (entries, photos, audit, localStorage)` + (after === before ? '' : ' ' + before + ' vs ' + after));
  };
  await failRep('localStorage fails part-way through Replace', () => { window.__lsFail = true; });
  await failRep('IndexedDB fails part-way through Replace', () => { window.Vault._testAbortAfter(1); });
  ok(await D.evaluate(async () => (await window.Vault.verifyAudit()).ok !== false), 'c: audit chain still verifies after the failed Replaces');
  await openImport(D, fA, P1); await doImport(D, 'replace'); await D.click('#tabs [data-tab=today]');
  ok(await rows(D) === 2 && await D.evaluate(() => localStorage.getItem('mb.favs') === JSON.stringify(['03.03A', '03.04A']) && localStorage.getItem('mb.layout') === null), 'c: Replace then works: device matches the file');
  const dD = await decrypt(D, (await exportMine(D, P2, fD)).env, P2);
  ok(norm(dD.encs) === norm(srcA.encs), 'c: Replace after failures: zero loss');
  ok(await D.evaluate(async () => (await window.Vault.verifyAudit()).ok !== false), 'c: audit chain verifies after Replace (one transaction)');
  // ---- c: in-app help (Settings) and the manual carry the same Your data wording (shared T.guide)
  await D.click('#tabs [data-tab=data]');
  const g = await D.evaluate(() => { const d = document.querySelector('#mvGuide'); return d && { s: d.querySelector('summary').textContent, li: [...d.querySelectorAll('li')].map(x => x.textContent), man: [...document.querySelectorAll('#m-data li')].map(x => x.textContent), toc: !!document.querySelector('.mantoc a[data-go="m-data"]'), T: window.MBMove.T.guide, help: document.querySelector('.mvhelp').nextElementSibling === d }; });
  ok(g && g.s === 'Your data: Export my data, Import my data and moving' && g.li.length === 8 && JSON.stringify(g.li) === JSON.stringify(g.T) && g.help, 'c: Settings help "Your data" (8 points, right after the Export/Import help line)');
  ok(g && JSON.stringify(g.man) === JSON.stringify(g.T) && g.toc, 'c: manual section 16 has the same wording as the in-app help');
  ok(g && g.li.some(t => /^Export my data/.test(t)) && g.li.some(t => /^Import my data/.test(t)) && g.li.some(t => /^This app is moving/.test(t)) && !g.li.some(t => /\bAI\b/.test(t)), 'c: help covers Export my data, Import my data and the moving banner');
  // ---- validation errors
  const bad = (n, s) => { const f = path.join(OUT, n); fs.writeFileSync(f, s); return f; };
  const errCase = async (f, rx, label) => { await openImport(C, f); const m = await C.textContent('#mvErr'); ok(rx.test(m) && await C.isHidden('#mvGo'), `${label}: "${m}"`); await C.click('#mvCancel'); };
  await errCase(bad('bad.json', '{nope'), /bad JSON/, 'bad JSON');
  await errCase(bad('empty.json', ''), /no data/, 'empty file');
  await errCase(bad('wrong.json', JSON.stringify(Object.assign({}, e, { app: 'feedesk' }))), /Fee Desk/, 'wrong app');
  await errCase(bad('newer.json', JSON.stringify(Object.assign({}, e, { schemaVersion: 2 }))), /newer version/, 'newer schema');
  await errCase(bad('fdold.json', JSON.stringify({ app: 'MedBilling Fee Desk', kind: 'favourites', version: 6, favourites: [] })), /./, 'b: old Fee Desk file refused by Logs');
  await errCase(bad('zero.json', JSON.stringify(Object.assign({}, e, { counts: { encounters: 0 } }))), /no data/, 'zero counts');
  // ---- banner
  for (const w of [390, 1280]) {
    const F = await mk(w, () => { window.MOVING_TO_URL = 'https://logs.medibrisa.com/'; });
    await setup(F, P1);
    ok(await F.isVisible('#mvBanner') && await F.textContent('#mvBTitle') === 'This app is moving', `[${w}] banner on with the flag`);
    ok(await F.getAttribute('#mvBUrl', 'href') === 'https://logs.medibrisa.com/' && await F.locator('#mvBanner ol.mvsteps li').count() === 4 && await F.isVisible('#mvBExport'), `[${w}] banner: new URL, 4 steps, Export button`);
    if (SHOTS) await F.screenshot({ path: path.join(SHOTS, `logs-banner-${w}.png`) });
    if (SHOTS && w === 390) { await F.click('#tabs [data-tab=data]'); await F.locator('.mvrow').scrollIntoViewIfNeeded(); await F.screenshot({ path: path.join(SHOTS, 'logs-export-390.png') });
      await F.click('#mvBDismiss').catch(() => {}); await openImport(F, fA, P1); await F.screenshot({ path: path.join(SHOTS, 'logs-import-preview-390.png') }); await F.click('#mvCancel'); await F.reload(); }
    else { await F.click('#mvBDismiss'); ok(await F.isHidden('#mvBanner').catch(() => true), `[${w}] Not now hides it`); await F.reload(); }
    await F.waitForTimeout(800);
    ok(!(await F.isVisible('#mvBanner').catch(() => false)), `[${w}] stays dismissed after reload (same session)`);
    const G = await F.context().newPage(); await G.goto(URL); await G.waitForTimeout(800);
    ok(await G.isVisible('#mvBanner'), `[${w}] shows again in a new session (new tab)`);
  }
  const fd = '/workspace/delara-medbilling/public';
  ok(fs.readFileSync(path.join(__dirname, '../public/js/shared/move.js'), 'utf8') === fs.readFileSync(fd + '/js/shared/move.js', 'utf8') || !fs.existsSync(fd), 'parity: move.js byte-identical to Fee Desk');
  ok(fs.readFileSync(path.join(__dirname, '../public/css/shared/move.css'), 'utf8') === fs.readFileSync(fd + '/css/shared/move.css', 'utf8') || !fs.existsSync(fd), 'parity: move.css byte-identical to Fee Desk');
  ok(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join(' | '));
  await browser.close(); console.log(fails ? `FAILED ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL crashed ' + e.stack); process.exit(1); });
