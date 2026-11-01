// QA reproducer c-lg-atomic (copied from /workspace/qa-29/moveprep/t/c-lg-atomic.js for 'd'; only paths/port adapted).
// move-prep: Export my data / Import my data and the "This app is moving" banner (shared js/shared/move.js). Synthetic data only.
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18940/medbilling-logs/ node tests/c-lg-atomic.test.js
const path = require('path'), fs = require('fs');
const { chromium, NAME_POS } = require('./helpers/cr-welcome');
const URL = process.env.URL || 'http://127.0.0.1:18940/medbilling-logs/';
const OUT = process.env.OUT || '/tmp/mbl-c-lg-atomic'; fs.mkdirSync(OUT, { recursive: true });
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
const SH = process.env.SH || OUT; fs.mkdirSync(SH + '/c', { recursive: true });
const fp = page => page.evaluate(async () => {
  const hex = v => v instanceof ArrayBuffer ? [...new Uint8Array(v)].map(x => x.toString(16).padStart(2, '0')).join('') : ArrayBuffer.isView(v) ? [...new Uint8Array(v.buffer)].map(x => x.toString(16).padStart(2, '0')).join('') : v;
  const ser = o => JSON.stringify(o, (k, v) => hex(v));
  const db = await new Promise((r, j) => { const q = indexedDB.open('bl-vault'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const out = {}; for (const s of db.objectStoreNames) out[s] = await new Promise(r => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(ser(q.result)); });
  db.close(); const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^mb\./.test(k)) ls[k] = localStorage.getItem(k); }
  return JSON.stringify({ out, ls: Object.keys(ls).sort().map(k => [k, ls[k]]) }); });
const bodyHas = (p, s) => p.evaluate(s => document.body.innerText.includes(s), s);
const FAILMSG = 'The import could not finish, so nothing on this device was changed';
async function unlock(p, pass) { await p.reload(); await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', pass); await p.click('#uBtn'); await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 30000 }); await p.waitForTimeout(800); }
async function tryReplace(p, file, inject, label) {
  const before = await fp(p);
  await openImport(p, file, P1); await p.check('input[name=mvMode][value=replace]'); await p.check('#mvSure');
  await p.evaluate(inject);
  await p.click('#mvGo'); await p.waitForTimeout(2500);
  const fired = await p.evaluate(() => window.__fired || 0);
  await p.evaluate(() => { window.__on = false; });
  const msg = await bodyHas(p, FAILMSG);
  const mid = await fp(p);
  await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); });
  await unlock(p, P1); const after = await fp(p);
  ok(fired > 0, `${label}: failure fired (${fired})`); ok(msg, `${label}: shows "nothing changed" message`);
  ok(mid === before, `${label}: data unchanged right after failure`); ok(after === before, `${label}: data unchanged after reload`);
  if (after !== before) { const a = JSON.parse(before), c = JSON.parse(after); for (const s of Object.keys(a.out)) if (a.out[s] !== c.out[s]) console.log('   diff store', s, JSON.parse(a.out[s]).length, '->', JSON.parse(c.out[s]).length); if (JSON.stringify(a.ls) !== JSON.stringify(c.ls)) console.log('   diff ls'); }
}
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const mk = async (w, init, mobile) => { const c = await browser.newContext({ viewport: { width: w, height: 800 }, timezoneId: 'America/Edmonton', acceptDownloads: true, isMobile: !!mobile, hasTouch: !!mobile }); if (init) await c.addInitScript(init); const p = await c.newPage(); p.on('pageerror', e => errors.push(String(e))); return p; };
  const A = await mk(1280); await setup(A, P1);
  await A.evaluate(() => { localStorage.setItem('mb.favs', JSON.stringify(['03.03A'])); localStorage.setItem('mb.jur', 'AB'); });
  await typeRow(A, 1, 'Sample, Maria', '100357913', 200, '03.04A', 'V22.1'); await typeRow(A, 2, 'Test, Omar', '100987654', 150, '03.08A', '626.2');
  const fA = path.join(OUT, 'lg-A.json'); await exportMine(A, P1, fA);
  await typeRow(A, 3, 'Demo, Lee', '100111222', 100, '03.03A', '780.6');
  await A.evaluate(() => { localStorage.setItem('mb.favs', JSON.stringify(['03.03A', '13.99A'])); localStorage.setItem('mb.extra', 'x'); });
  ok((await rows(A)) === 3, 'diverged state has 3 rows');
  await tryReplace(A, fA, () => { let n = 0; window.__on = true; window.__fired = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__on && /^mb\./.test(k) && ++n === 1) { window.__fired++; throw new DOMException('quota', 'QuotaExceededError'); } return o.call(this, k, v); }; }, 'ls setItem throws #1');
  await tryReplace(A, fA, () => { window.__fired = 1; window.Vault._testAbortAfter(1); }, 'Vault abort after 1 write');
  await tryReplace(A, fA, () => { window.__fired = 1; window.Vault._testAbortAfter(3); }, 'Vault abort after 3 writes');
  await tryReplace(A, fA, () => { let n = 0; window.__on = true; window.__fired = 0; const o = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...a) { if (window.__on && this.name === 'enc' && ++n === 1) { window.__fired++; throw new DOMException('sync put fail', 'DataError'); } return o.apply(this, a); }; }, 'IDB put throws synchronously #1');
  const bad = JSON.parse(fs.readFileSync(fA, 'utf8')); console.log('data keys', Object.keys(bad.data)); const lsk = bad.data.localStorage ? 'localStorage' : bad.data.ls ? 'ls' : null; const fB = path.join(OUT, 'lg-bad.json');
  if (lsk) { const k0 = Object.keys(bad.data[lsk])[0]; bad.data[lsk][k0] = 42; } fs.writeFileSync(fB, JSON.stringify(bad));
  { const before = await fp(A); await openImport(A, fB, P1, true); await A.waitForTimeout(2500); const dmg = await bodyHas(A, 'damaged or incomplete'); await A.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); }); ok(dmg, 'bad ls value rejected (damaged or incomplete) key=' + lsk); ok((await fp(A)) === before, 'bad record: nothing changed'); }
  await openImport(A, fA, P1); await doImport(A, 'replace'); ok((await rows(A)) === 2, 'control replace: back to 2 rows from file');
  ok(await A.evaluate(() => localStorage.getItem('mb.extra') === null && localStorage.getItem('mb.favs') === '["03.03A"]'), 'control replace: localStorage equals file');
  const S = await mk(390, () => { window.__sh = []; navigator.canShare = () => true; navigator.share = d => { window.__sh.push({ title: d.title, files: (d.files || []).map(f => f.name) }); return Promise.resolve(); }; }, true);
  await setup(S, P2); await S.click('#tabs [data-tab=data]'); await S.click('#mvExport'); await S.waitForSelector('#askDlg[open]'); await S.fill('#ask_p', P2); await S.click('#askOk'); await S.waitForTimeout(3000);
  const sh = await S.evaluate(() => window.__sh); ok(sh.length && sh[0].title === 'MedBilling Logs: my data', 'Logs share title = ' + JSON.stringify(sh));
  await S.screenshot({ path: SH + '/c/lg-share-390.png' });
  ok(!errors.filter(e => !/sync put fail|quota/.test(e)).length, 'no unexpected page errors ' + errors.join(' | ').slice(0, 300));
  console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); await browser.close(); process.exit(fails ? 1 : 0);
})();
