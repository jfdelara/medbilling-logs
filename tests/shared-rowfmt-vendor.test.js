// b11: Logs vendors Fee Desk's shared code-row formatter. The two files in public/js/shared/ must stay byte-identical to
// Fee Desk's public/js/shared/ (source commit a11ad4c) and to the pinned sha256s below. If the Fee Desk folder is absent
// (e.g. a Logs-only zip), the cross-app comparison is skipped with a reason; the pinned-hash checks always run.
// Fee Desk folder: FEEDESK_DIR, else ../../delara-medbilling relative to this file (the /workspace layout).
// Run: node tests/shared-rowfmt-vendor.test.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PIN = { 'rowfmt.js': '23c3e40e9621f8a8eacde0c3d9f838b152d12b99312dfbb68c014341df709c88', 'short-names.js': '0135c556fcda7af3753725120ff8fecdd69aa800bbb767e68ec07ac5dd50ca06' };
const LOGS = path.join(__dirname, '..', 'public', 'js', 'shared');
const FD = path.join(process.env.FEEDESK_DIR || path.join(__dirname, '..', '..', 'delara-medbilling'), 'public', 'js', 'shared');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
for (const [f, h] of Object.entries(PIN)) {
  const p = path.join(LOGS, f), b = fs.existsSync(p) ? fs.readFileSync(p) : null;
  ok(!!b, `Logs public/js/shared/${f} present`);
  if (b) ok(sha(b) === h, `Logs ${f} sha256 matches the pinned Fee Desk a11ad4c hash (${sha(b).slice(0, 12)}…)`);
}
const boot = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'rowfmt-boot.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
ok(/from '\.\/shared\/rowfmt\.js'/.test(boot), 'rowfmt-boot.js imports the vendored shared/rowfmt.js');
ok(html.indexOf('<script type="module" src="js/rowfmt-boot.js"></script>') > -1 && html.indexOf('js/rowfmt-boot.js') < html.indexOf('src="js/app.js"'), 'index.html loads the boot module before app.js');
ok(['js/rowfmt-boot.js', 'js/shared/rowfmt.js', 'js/shared/short-names.js'].every(a => sw.includes(`'${a}'`)), 'sw.js caches the boot module and both shared files (offline)');
if (!fs.existsSync(FD)) console.log(`SKIP 4 checks (cross-app byte comparison, 2 per shared file): reason: Fee Desk folder not found at ${FD}. A Logs-only zip has no Fee Desk; set FEEDESK_DIR to compare. The pinned-hash checks above still ran. This is why a Logs-only run counts 4 fewer passes.`);
else for (const f of Object.keys(PIN)) {
  const a = path.join(LOGS, f), b = path.join(FD, f);
  if (!fs.existsSync(b)) { ok(false, `Fee Desk ${f} present in ${FD}`); continue; }
  const A = fs.readFileSync(a), B = fs.readFileSync(b);
  ok(A.equals(B), `Logs ${f} is byte-identical to Fee Desk's (${A.length} vs ${B.length} bytes)`);
  ok(sha(B) === PIN[f], `Fee Desk ${f} still matches the pinned sha256 (re-vendor and re-pin if Fee Desk changed it)`);
}
console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
