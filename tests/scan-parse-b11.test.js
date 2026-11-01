// b11: patient scan parser (pure, fake data only). Run: node tests/scan-parse-b11.test.js
global.window = undefined; const S = require('../public/js/scan.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
let r = S.parse('ALBERTA HEALTH CARE\nTESTPATIENT, ALICE\nPHN 90000-0001\nSEX: F\nDOB 1980-01-02');
ok(r.uli === '900000001', 'labelled PHN with dash → 9 digits'); ok(r.name === 'Testpatient, Alice', 'card name tidied: ' + r.name); ok(r.sex === 'F', 'SEX: F');
r = S.parse('MRN 0012345678\nSAMPLE, BOB\nM/45Y\n900000002');
ok(r.uli === '900000002', 'bare 9-digit ULI, a 10-digit MRN ignored'); ok(r.sex === 'M', 'M/45Y'); ok(r.name === 'Sample, Bob', 'label name');
r = S.parse(['PID|1||900000003^^^AB^ULI||FAKENAME^CAROL||19700101|F']);
ok(r.uli === '900000003', 'barcode HL7-style ULI'); ok(r.name === 'FAKENAME, CAROL' || r.name === 'Fakename, Carol', 'HL7 name: ' + r.name);
r = S.parse('Date 2026-10-19 Room 12'); ok(!r.uli && !r.name && !r.sex, 'nothing invented from a date');
r = S.parse('Gender: Male\nName: Demo, Dan\nULI: 900000004'); ok(r.uli === '900000004' && r.sex === 'M' && r.name === 'Demo, Dan', 'labelled fields');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
