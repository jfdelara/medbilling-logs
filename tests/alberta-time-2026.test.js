// Alberta Time (ABT): permanent UTC-6 from Sun Nov 1, 2026 02:00 (08:00 UTC), IANA tzdata 2026c. Plain Node, no browser.
// Runs report.js + claims.js under three zone-data situations, each in its own process:
//   engine  - whatever zone data this Node/ICU has (Node 20 on the box ships ICU tz 2024b = stale)
//   fresh   - America/Edmonton forced to the 2026c rule (UTC-6 from the cutover), i.e. an updated browser / iOS
//   stale   - America/Edmonton forced to the old rule (UTC-7 after Nov 1, 2026), i.e. a browser / iOS that was never updated
// Every mode must give the same Alberta wall-clock times, periods, premiums and claim cutoffs.
// Run: node tests/alberta-time-2026.test.js
const { spawnSync } = require('child_process');
const MODE = (process.argv.find(a => a.startsWith('--mode=')) || '').slice(7);
if (!MODE) {
  let bad = 0;
  for (const m of ['engine', 'fresh', 'stale']) {
    const r = spawnSync(process.execPath, [__filename, '--mode=' + m], { encoding: 'utf8', env: Object.assign({}, process.env, { TZ: process.env.TZ || 'UTC' }) });
    process.stdout.write(`--- mode ${m}\n` + r.stdout + r.stderr); if (r.status !== 0) bad++;
  }
  console.log(bad ? `${bad} mode(s) FAILED` : 'ALL MODES PASS'); process.exit(bad ? 1 : 0);
}
const CUT = Date.UTC(2026, 10, 1, 8);
if (MODE !== 'engine') {   // emulate a zone database: before the cutover the engine's own data (MDT/MST history), after it fixed UTC-6 or UTC-7
  const Orig = Intl.DateTimeFormat, after = MODE === 'fresh' ? 'Etc/GMT+6' : 'Etc/GMT+7';
  const Fake = function (loc, o) {
    const real = new Orig(loc, o); if (!o || o.timeZone !== 'America/Edmonton') return real;
    const late = new Orig(loc, Object.assign({}, o, { timeZone: after })), pick = d => (+new Date(d) >= CUT ? late : real);
    return { format: d => pick(d).format(d), formatToParts: d => pick(d).formatToParts(d), resolvedOptions: () => real.resolvedOptions() };
  };
  Fake.prototype = Orig.prototype; Fake.supportedLocalesOf = Orig.supportedLocalesOf; Intl.DateTimeFormat = Fake;
}
global.window = globalThis;
require('../public/js/report.js'); require('../public/js/claims.js');
const R = globalThis.BLR, C = globalThis.MBClaims;
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const Z = s => Date.parse(s);                    // explicit UTC instant
const A = s => Date.parse(s + ':00-06:00');      // Alberta Time wall clock (UTC-6), valid from Mar 8, 2026 on
const wall = t => { const w = R.edm(t); return `${w.key} ${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`; };
const enc = (s, e) => ({ id: 'x' + s, kind: 'enc', segs: [{ s, e }], codes: [], updated: 1 });
const realStale = (() => { const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', hour: '2-digit', hourCycle: 'h23' }); return +f.format(new Date(Date.UTC(2027, 0, 15, 18))) !== 12; })();
console.log(`zone data: ${MODE}${MODE === 'engine' ? ` (ICU tz ${process.versions.tz || '?'}, ${realStale ? 'stale' : 'current'})` : ''}; report.js tzStale=${R.tzStale}`);
ok(R.tzStale === (MODE === 'stale' || (MODE === 'engine' && realStale)), 'stale zone data detected exactly when present');
// the requested probe points
ok(wall(Z('2026-11-01T07:30:00Z')) === '2026-11-01 01:30', '2026-11-01 01:30 Edmonton (07:30 UTC, before the cutover) shows 01:30');
ok(wall(Z('2026-11-01T08:30:00Z')) === '2026-11-01 02:30', '08:30 UTC Nov 1 shows 02:30 (no second 01:30)');
ok(wall(A('2026-11-02T18:00')) === '2026-11-02 18:00' && A('2026-11-02T18:00') === Z('2026-11-03T00:00:00Z'), '2026-11-02 18:00 Edmonton = 00:00 UTC Nov 3, shown as 18:00');
ok(wall(Z('2027-01-15T18:00:00Z')) === '2027-01-15 12:00' && wall(Z('2027-07-01T18:00:00Z')) === '2027-07-01 12:00', 'winter and summer 2027 both UTC-6');
ok(wall(Z('2027-03-14T08:30:00Z')) === '2027-03-14 02:30', 'Mar 14, 2027: no spring-forward, 02:30 exists');
ok(R.dayKey(Z('2026-11-03T06:30:00Z')) === '2026-11-03', 'day key just after midnight Nov 3 (00:30) is Nov 3, not Nov 2');
ok(wall(Z('2026-10-31T23:00:00Z')) === '2026-10-31 17:00', 'before the cutover (MDT) unchanged: 23:00 UTC Oct 31 = 17:00');
ok(wall(Z('2026-03-01T19:00:00Z')) === '2026-03-01 12:00', 'history unchanged: Mar 1, 2026 was MST (UTC-7)');
// EV / NTPM / NTAM / WK premium windows (03.01AA TEV / TNTP / TNTA / TWK / TST / TDES)
const pc = s => R.premCode(A(s));
ok(pc('2026-11-02T16:59') === null && pc('2026-11-02T17:00') === 'TEV' && pc('2026-11-02T18:00') === 'TEV' && pc('2026-11-02T21:59') === 'TEV', 'Mon Nov 2: 16:59 none, 17:00–21:59 TEV (EV)');
ok(pc('2026-11-02T22:00') === 'TNTP' && pc('2026-11-02T23:59') === 'TNTP', 'Mon Nov 2 22:00–23:59 TNTP (NTPM)');
ok(pc('2026-11-03T00:00') === 'TNTA' && pc('2026-11-03T06:59') === 'TNTA' && pc('2026-11-03T07:00') === null, 'Tue Nov 3 00:00–06:59 TNTA (NTAM), 07:00 none');
ok(pc('2026-11-07T06:59') === 'TNTA' && pc('2026-11-07T07:00') === 'TWK' && pc('2026-11-07T21:59') === 'TWK' && pc('2026-11-07T22:00') === 'TNTP', 'Sat Nov 7: 06:59 TNTA, 07:00–21:59 TWK (WK), 22:00 TNTP');
ok(pc('2026-11-01T02:30') === 'TNTA' && pc('2026-11-01T07:00') === 'TWK', 'Sun Nov 1 (cutover day): 02:30 TNTA, 07:00 TWK');
ok(pc('2026-11-11T12:00') === 'TST' && R.holidayName('2026-11-11') === 'Remembrance Day', 'Wed Nov 11, 2026 Remembrance Day 12:00 → TST');
ok(pc('2026-12-28T12:00') === 'TDES' && pc('2026-12-25T07:00') === 'TST', 'Mon Dec 28, 2026 (designated Boxing Day) → TDES; Christmas 07:00 → TST');
const pa = R.periodAt(A('2026-11-02T18:00'));
ok(pa.p.id === 'wd_eve' && pa.start === A('2026-11-02T17:00') && pa.end === A('2026-11-02T22:00'), 'period instance on Nov 2 evening runs 17:00–22:00 Alberta Time');
const pn = R.periodAt(Z('2026-11-01T06:30:00Z'));
ok(pn.p.id === 'we_night' && pn.start === Z('2026-11-01T06:00:00Z') && pn.end === Z('2026-11-01T13:00:00Z'), 'Sun Nov 1 overnight period 00:00 (MDT) → 07:00 (UTC-6) is 7 h, no extra hour');
// units across the cutover: 00:30 MDT → 03:30 Alberta Time is 3 real hours, all Sunday overnight
let sp = R.periodSplit(enc(Z('2026-11-01T06:30:00Z'), Z('2026-11-01T09:30:00Z')));
ok(sp.parts.length === 1 && sp.parts[0].id === 'we_night' && sp.parts[0].m === 180 && sp.parts[0].u === 12, `encounter across 02:00 Nov 1: 180 min, 12 units, all weekend night (${JSON.stringify(sp.parts)})`);
sp = R.periodSplit(enc(A('2026-11-02T16:30'), A('2026-11-02T18:00')));
const by = Object.fromEntries(sp.parts.map(p => [p.id, p]));
ok(by.wd_day && by.wd_day.m === 30 && by.wd_eve && by.wd_eve.m === 60 && by.wd_eve.u === 4, 'Mon Nov 2 16:30–18:00: 30 min day + 60 min evening (4 TEV units)');
ok(R.muSuggest(Object.assign(enc(A('2026-11-02T16:30'), A('2026-11-02T18:00')), {}), 'TEV') === 4 && R.muSuggest(enc(A('2026-11-02T16:30'), A('2026-11-02T18:00')), 'EV') === 4, 'TEV / EV unit suggestion = 4 for that encounter');
const cnt = R.premCounts([enc(A('2026-11-07T06:00'), A('2026-11-07T08:00'))]);
ok(cnt.get('2026-11-07|TNTA') === 4 && cnt.get('2026-11-07|TWK') === 4, 'Sat Nov 7 06:00–08:00: 4 TNTA + 4 TWK units');
// H-Link claim cutoffs (Thursday 4:00 PM approvals, 4:30 PM submission)
let x = C.batchFor(A('2026-11-05T15:59'), R.holidayName); ok(x.batch === '2026-11-05' && !x.rolled, 'Thu Nov 5 3:59 PM → this batch');
x = C.batchFor(Z('2026-11-05T22:15:00Z'), R.holidayName); ok(x.batch === '2026-11-12' && x.rolled, 'Thu Nov 5 4:15 PM Alberta Time (22:15 UTC) → rolls to Nov 12');
ok(C.batchFor(A('2026-11-05T09:00'), null).closeAt === Z('2026-11-05T22:00:00Z'), 'close at 4:00 PM = 22:00 UTC');
ok(C.at('2026-11-02', 18, 0) === A('2026-11-02T18:00') && C.at('2026-11-01', 1, 30) === Z('2026-11-01T07:30:00Z'), 'wall clock → timestamp: Nov 2 18:00 and Nov 1 01:30 (single, MDT)');
console.log(fails ? `${fails} of ${n} FAILED` : `ALL PASS (${n})`); process.exit(fails ? 1 : 0);
