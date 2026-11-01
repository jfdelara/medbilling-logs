// b11: row number → full entry window with a Patient "Type / Photo" choice (static source checks; UI is covered by scripts/shots-b11.js)
const s = require('fs').readFileSync(__dirname + '/../public/js/app.js', 'utf8'); let f = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) f++; };
ok(/const rnc = t\.closest\('tbody th\.rn'\)[^\n]*\n[^\n]*return ewOpen\(tr\)/.test(s), 'row-number click opens the entry window (v9r behaviour kept)');
ok(/if \(rn\) return;\s+\/\/ b11: a row number always opens the entry window/.test(s), 'touch on a row number no longer diverts to the scan/type menu');
ok(s.includes('data-ewm="type"') && s.includes('data-ewm="scan"') && s.includes('📷 Photo</button>'), 'entry window has Type and Photo buttons');
ok(/function ewScan\(\)[\s\S]{0,400}MBScan\.open\([\s\S]{0,200}ewScanFill\(v\)/.test(s), 'Photo runs the scan sheet and fills the window');
ok(/function ewScanFill[\s\S]{0,300}'ew_name'[\s\S]{0,60}'ew_mrn'[\s\S]{0,60}'ew_sex'/.test(s), 'fills Name, MRN/PHN and Sex');
console.log(f ? f + ' FAILED' : `ALL PASS (${n})`); process.exit(f ? 1 : 0);
