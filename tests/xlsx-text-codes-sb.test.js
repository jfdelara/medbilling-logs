// S-B: the Excel export writes every code (fee codes, modifiers, Dx/ICD-9) and identifier as a TEXT cell, so leading zeros survive
// (ICD-9 078.1 / 078.10, fee code 00100, digit-only modifiers, facility / centre numbers). Exports through the same R.xlsx the
// Reports dialog uses, then parses the .xlsx (zip -> xl/worksheets/sheet1.xml, Python stdlib) and checks cell type + exact value.
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:PORT/medbilling-logs/ node /workspace/mbl-wt-uibugs/tests/xlsx-text-codes-sb.test.js
const { chromium } = require('./helpers/cr-welcome');
const { execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const URL0 = process.env.URL || 'http://127.0.0.1:18792/medbilling-logs/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PY = String.raw`
import sys, zipfile, json, re, xml.etree.ElementTree as ET
N = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
z = zipfile.ZipFile(sys.argv[1]); st = ET.fromstring(z.read('xl/styles.xml'))
xfs = [x.get('numFmtId') for x in st.find(N + 'cellXfs')]
rows = ET.fromstring(z.read('xl/worksheets/sheet1.xml')).find(N + 'sheetData')
out = []
for r in rows:
  row = {}
  for c in r:
    ref = re.match(r'[A-Z]+', c.get('r')).group(0); t = c.get('t') or 'n'; s = int(c.get('s') or 0)
    v = ''.join(x.text or '' for x in c.iter(N + 't')) if t == 'inlineStr' else (c.find(N + 'v').text if c.find(N + 'v') is not None else '')
    row[ref] = {'t': t, 'v': v, 'fmt': xfs[s]}
  out.append(row)
print(json.dumps(out))`;
(async () => {
  const b = await chromium.launch(), p = await b.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL0); await p.waitForFunction(() => window.BLR && window.XlsxLite);
  const b64 = await p.evaluate(async () => {
    const s = new Date(2026, 9, 21, 9, 0).getTime(), mk = (id, x) => Object.assign({ id, kind: 'enc', name: 'Zero ' + id, mrn: '0012345', chart: '007', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', notes: [], segs: [{ s, e: s + 1800e3 }], status: 'done', photos: [], links: [], created: s, updated: s }, x);
    const encs = [
      mk('z1', { codes: [{ c: '03.03A', k: '03.03A', d: '', j: 'AB', f: '', dx: '078.10' }], mod1: '01', mod2: 'CMGP', facNo: '0042', fcen: '0703', refId: '012345' }),
      mk('z2', { codes: [{ c: '00100', k: '00100', d: '', j: 'BC', f: '', dx: '078.1' }], mod1: '', mod2: '' }),
      mk('z3', { codes: [{ c: '03.04A', k: '03.04A', d: '', j: 'AB', f: '', dx: '0781' }] })];
    const blob = BLR.xlsx(encs, '2026-10-01', '2026-10-31', { now: s + 7200e3, notes: false });
    const u = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(bin);
  });
  const f = path.join(os.tmpdir(), 'sb-xlsx-' + process.pid + '.xlsx'); fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  let rows = []; try { rows = JSON.parse(execFileSync('python3', ['-c', PY, f]).toString()); } catch (e) { ok(false, 'xlsx parses: ' + e.message.split('\n')[0]); }
  fs.unlinkSync(f);
  ok(rows.length === 4, `Entries sheet: header + 3 rows (${rows.length})`);
  const head = rows[0] || {}, colOf = h => Object.keys(head).find(k => head[k].v === h);
  const cell = (ri, h) => (rows[ri] || {})[colOf(h)] || null;
  const want = [[1, 'diagnostic_code', '078.10'], [2, 'diagnostic_code', '078.1'], [3, 'diagnostic_code', '0781'], [2, 'codes', '00100'], [1, 'codes', '03.03A'],
    [1, 'modifier_1', '01'], [1, 'modifier_2', 'CMGP'], [1, 'facility_number', '0042'], [1, 'functional_centre', '0703'], [1, 'mrn_phn', '0012345'], [1, 'chart', '007'], [1, 'referring_provider_id', '012345']];
  for (const [ri, h, v] of want) {
    const c = cell(ri, h);
    if (!colOf(h)) { ok(false, `column ${h} present`); continue; }
    ok(!!c && c.t === 'inlineStr', `row ${ri} ${h}: text cell (t="${c && c.t}")`);
    ok(!!c && c.v === v, `row ${ri} ${h}: exact value "${v}" (got "${c && c.v}")`);
    ok(!!c && c.fmt === '49', `row ${ri} ${h}: Text number format '@' (numFmtId ${c && c.fmt}) so edits keep zeros`);
  }
  // non-code columns keep their numbers (minutes stays numeric)
  const m = cell(1, 'minutes'); ok(!!m && m.t === 'n' && m.v === '30', `minutes stays a number cell (t="${m && m.t}", v=${m && m.v})`);
  ok(cell(0, 'codes') && cell(0, 'codes').t === 'inlineStr', 'header row unchanged (text, bold style)');
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
