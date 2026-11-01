// b11 Sex column: scan parse → stored e.ma.sex → claim warning → CSV/Excel export (fake data only). Run: node tests/sex-b11.test.js
process.env.TZ = process.env.TZ || 'UTC'; global.window = globalThis;
require('../public/js/report.js'); require('../public/js/claims.js'); const S = require('../public/js/scan.js');
const C = globalThis.MBClaims, R = globalThis.BLR;
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// parsing: M, F, X and U (unknown) are kept apart
ok(S.parse('SEX: M').sex === 'M' && S.parse('Gender: Female').sex === 'F', 'M / Female');
ok(S.parse('SEX: X').sex === 'X', 'X stays X');
ok(S.parse('SEX: U').sex === 'U' && S.parse('Sex: Unknown').sex === 'U', 'U / Unknown → U (no longer folded into X)');
ok(!S.parse('Room 12 bed U').sex, 'a stray U is not a sex');
// storage round trip: what the scan sheet / grid / entry window write (e.ma.sex) survives JSON (the vault stores JSON)
const t = Date.parse('2026-10-19T17:05:00-06:00');
const mk = (id, sex) => { const e = { id, kind: 'enc', name: 'Testpatient, Alice', mrn: '900000001', chart: '', label: '', initials: '', billingNote: '', setting: 'H', facility: null, type: '', codes: [{ c: '03.03A', dx: '780' }], notes: [], segs: [{ s: t, e: t + 25 * 60000 }], status: 'done', photos: [], links: [], created: t, at: t, updated: t }; if (sex) e.ma = { sex }; return e; };
const scanned = S.parse('FAKE TEST CARD\nTESTPATIENT, ALICE\nPHN 90000-0001\nSEX: F');
const e1 = JSON.parse(JSON.stringify(mk('a', scanned.sex)));
ok(e1.ma.sex === 'F', 'scanned F stored in e.ma.sex and read back');
// claim banner rule: missing Sex warns but never blocks approval
const e0 = mk('b', '');
ok(C.sexMissing(e0) && !C.sexMissing(e1), 'sexMissing: empty → true, F → false');
ok(['M', 'F', 'X', 'U'].every(x => !C.sexMissing(mk('c', x))) && C.sexMissing(mk('d', 'Q')), 'M/F/X/U accepted, anything else flagged');
ok(C.warnOf(e0).join() === 'Sex' && !C.warnOf(e1).length, 'warnOf lists Sex only when missing');
ok(!C.missingOf(e0).includes('Sex') && C.stateOf(e0) === C.stateOf(e1), 'missing Sex is non-blocking (same approval state)');
// export: CSV / Excel "Entries" have a sex column right after mrn_phn
const tb = R.table([e1, mk('e', 'U'), e0], '2026-10-19', '2026-10-19', t + 3600000, null, {});
const si = tb.head.indexOf('sex');
ok(si === tb.head.indexOf('mrn_phn') + 1, 'sex column after mrn_phn');
ok(tb.rows.map(r => r[si]).join() === 'F,U,', 'exported values F, U, (blank): ' + tb.rows.map(r => r[si]).join());
console.log(fails ? `${fails} FAILED` : `ALL PASS (${n})`); process.exit(fails ? 1 : 0);
