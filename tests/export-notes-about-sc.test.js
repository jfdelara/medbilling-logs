// S-C (Jose, 2026-10-22): billing notes STAY in the exports. The About text must match the actual columns:
// billing notes always included (billing_note / Billing note column); timestamped notes only with "Include notes".
// Checks the Excel About sheet against the Entries header, and the Markdown/DOCX/PDF footnote text (shared NOTES_OFF).
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:PORT/medbilling-logs/ node /workspace/mbl-wt-uibugs/tests/export-notes-about-sc.test.js
const { chromium } = require('./helpers/cr-welcome');
const { execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const URL0 = process.env.URL || 'http://127.0.0.1:18792/medbilling-logs/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PY = String.raw`
import sys, zipfile, json, re, xml.etree.ElementTree as ET
N = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
z = zipfile.ZipFile(sys.argv[1]); out = {}
wb = ET.fromstring(z.read('xl/workbook.xml')); names = [s.get('name') for s in wb.iter(N + 'sheet')]
for i, nm in enumerate(names):
  rows = ET.fromstring(z.read('xl/worksheets/sheet%d.xml' % (i + 1))).find(N + 'sheetData')
  out[nm] = [[''.join(x.text or '' for x in c.iter(N + 't')) or (c.find(N + 'v').text if c.find(N + 'v') is not None else '') for c in r] for r in rows]
print(json.dumps(out))`;
(async () => {
  const b = await chromium.launch(), p = await b.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL0); await p.waitForFunction(() => window.BLR && window.XlsxLite);
  const res = await p.evaluate(async () => {
    const s = new Date(2026, 9, 21, 9, 0).getTime();
    const encs = [{ id: 'n1', kind: 'enc', name: 'Note Row', mrn: '', chart: '', label: '', initials: '', billingNote: 'bill this as 03.03A', setting: 'H', facility: null, type: '', codes: [{ c: '03.03A', k: '03.03A', d: '', j: 'AB', f: '$25.09 base' }], notes: [{ id: 'a', t: s, x: 'clinical note text' }], segs: [{ s, e: s + 1800e3 }], status: 'done', photos: [], links: [], created: s, updated: s }];
    const b64 = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(bin); };
    return { off: await b64(BLR.xlsx(encs, '2026-10-01', '2026-10-31', { now: s + 7200e3, notes: false })), on: await b64(BLR.xlsx(encs, '2026-10-01', '2026-10-31', { now: s + 7200e3, notes: true })),
      md: await BLR.md(encs, '2026-10-01', '2026-10-31', { now: s + 7200e3, notes: false }).text() };
  });
  for (const k of ['off', 'on']) {
    const f = path.join(os.tmpdir(), 'sc-' + k + process.pid + '.xlsx'); fs.writeFileSync(f, Buffer.from(res[k], 'base64'));
    let wb = {}; try { wb = JSON.parse(execFileSync('python3', ['-c', PY, f]).toString()); } catch (e) { ok(false, 'xlsx parses: ' + e.message.split('\n')[0]); } fs.unlinkSync(f);
    const ent = wb.Entries || [], head = ent[0] || [], about = (wb.About || []).map(r => r.join(' ')).join('\n');
    const bi = head.indexOf('billing_note');
    ok(bi > -1 && (ent[1] || []).includes('bill this as 03.03A'), `${k}: Entries has billing_note filled (kept, per Jose) (${bi}: ${JSON.stringify((ent[1] || []).slice(Math.max(0, bi - 1), bi + 2))})`);
    ok(/Billing notes are included \(column "billing_note"/.test(about), `${k}: About says billing notes are included ("billing_note" column)`);
    ok(!/^Notes are not included/m.test(about), `${k}: About no longer says plain "Notes are not included"`);
    const hasNotes = head.includes('notes');
    ok(hasNotes === (k === 'on'), `${k}: notes column ${k === 'on' ? 'present' : 'absent'}`);
    ok(hasNotes ? /Timestamped notes are included \(column "notes"/.test(about) : /Timestamped notes are not included/.test(about), `${k}: About text on timestamped notes matches the columns`);
  }
  ok(/Billing notes are included/.test(res.md) && /Timestamped notes are not included/.test(res.md) && /Billing note/.test(res.md), 'Markdown (same NOTES_OFF text as DOCX/PDF): billing notes included, timestamped notes not');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'report.js'), 'utf8');
  ok((src.match(/NOTES_OFF/g) || []).length >= 4 && !/'Notes are not included/.test(src), 'DOCX, PDF and Markdown footnotes use the corrected NOTES_OFF; no other "Notes are not included" wording');
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
