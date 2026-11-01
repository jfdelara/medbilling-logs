// Claims cutoff / batch / pay-date rules (claims.js) with the Alberta holidays from report.js. Plain Node, no browser.
// Run: node /workspace/medbilling-logs/tests/claims-cutoff.test.js
process.env.TZ = process.env.TZ || 'UTC';   // the rules must not depend on the device zone
global.window = globalThis;
require('../public/js/report.js'); require('../public/js/claims.js');
const C = globalThis.MBClaims, R = globalThis.BLR, hol = k => R.holidayName(k);
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = s => Date.parse(s);
const b = (s, h) => C.batchFor(T(s), h === false ? null : hol);
// 1. 3:59 vs 4:00 PM Thursday (MDT, UTC-6)
let x = b('2026-10-22T15:59:00-06:00'); ok(x.batch === '2026-10-22' && !x.rolled && x.pay === '2026-10-30', `Thu Oct 22 3:59 PM → this week's batch (Thu Oct 22), pay Fri Oct 30 (${x.batch}, ${x.pay})`);
x = b('2026-10-22T15:59:59.999-06:00'); ok(x.batch === '2026-10-22' && !x.rolled, 'Thu 3:59:59.999 PM still in this batch');
x = b('2026-10-22T16:00:00-06:00'); ok(x.batch === '2026-10-29' && x.rolled && x.pay === '2026-11-06', `Thu Oct 22 4:00 PM → rolls to Thu Oct 29, pay Fri Nov 6 (${x.batch}, ${x.pay})`);
x = b('2026-10-22T16:29:00-06:00'); ok(x.batch === '2026-10-29' && x.rolled, 'Thu 4:29 PM (approvals closed, submission still open) → rolls');
x = b('2026-10-22T16:30:00-06:00'); ok(x.batch === '2026-10-29' && x.rolled, 'Thu 4:30 PM → rolls');
ok(C.noteFor(b('2026-10-22T16:00:00-06:00')).includes('rolls to the next batch') && C.noteFor(b('2026-10-22T16:00:00-06:00')).includes('Expected pay Fri Nov 6, 2026'), 'roll-over note names the next batch week and the pay date');
ok(!C.noteFor(b('2026-10-22T15:59:00-06:00')).includes('rolls'), 'no roll-over wording before the cutoff');
// 2. other days of the week
x = b('2026-10-23T00:01:00-06:00'); ok(x.batch === '2026-10-29' && !x.rolled, 'Fri after a batch → next Thursday, not marked rolled');
x = b('2026-10-27T09:00:00-06:00'); ok(x.batch === '2026-10-29' && x.procFrom === '2026-10-27', 'Tuesday (processing starts) → that Thursday; processing Tue Oct 27 – Thu Oct 29');
x = b('2026-10-21T23:59:00-06:00'); ok(x.batch === '2026-10-22', 'Wed 11:59 PM → Thursday next day');
x = b('2026-10-22T00:00:00-06:00'); ok(x.batch === '2026-10-22' && !x.rolled, 'Thu 12:00 AM → same day batch');
ok(b('2026-10-22T15:59:00-06:00').closeAt === T('2026-10-22T16:00:00-06:00') && b('2026-10-22T15:59:00-06:00').submitAt === T('2026-10-22T16:30:00-06:00'), 'close 4:00 PM and submit 4:30 PM in Edmonton time (MDT)');
// 3. device time zone must not matter: same instant expressed in UTC
x = C.batchFor(T('2026-10-22T21:59:00Z'), hol); ok(x.batch === '2026-10-22', '21:59 UTC = 3:59 PM MDT → this batch');
x = C.batchFor(T('2026-10-22T22:00:00Z'), hol); ok(x.batch === '2026-10-29', '22:00 UTC = 4:00 PM MDT → rolls');
// 4. Alberta Time: the clocks went forward Sun Mar 8, 2026 for the last time; from Sun Nov 1, 2026 02:00 Alberta stays on
//    UTC-6 all year (IANA tzdata 2026c). No fall-back on Nov 1, 2026 and no spring-forward on Mar 14, 2027.
x = b('2026-11-05T15:59:00-06:00'); ok(x.batch === '2026-11-05' && !x.rolled, 'Thu Nov 5 (first week of permanent Alberta Time) 3:59 PM → this batch');
x = b('2026-11-05T16:00:00-06:00'); ok(x.batch === '2026-11-12' && x.rolled, 'Thu Nov 5 4:00 PM (UTC-6) → rolls to Nov 12');
x = C.batchFor(T('2026-11-05T21:59:00Z'), hol); ok(x.batch === '2026-11-05' && !x.rolled, '21:59 UTC on Nov 5 = 3:59 PM Alberta Time → this batch');
x = C.batchFor(T('2026-11-05T22:15:00Z'), hol); ok(x.batch === '2026-11-12' && x.rolled, '22:15 UTC Nov 5 = 4:15 PM Alberta Time → rolls (stale UTC-7 zone data would show 3:15 PM and keep it)');
ok(b('2026-11-05T12:00:00-06:00').closeAt === T('2026-11-05T22:00:00Z'), 'Nov 5 close time is 4:00 PM UTC-6 (22:00 UTC)');
ok(b('2026-11-05T12:00:00-06:00').submitAt === T('2026-11-05T22:30:00Z'), 'Nov 5 submission cutoff is 4:30 PM UTC-6 (22:30 UTC)');
x = b('2026-10-29T15:00:00-06:00'); ok(x.pay === '2026-11-06' && x.closeAt === T('2026-10-29T16:00:00-06:00'), 'batch Thu Oct 29 pays Fri Nov 6: the pay date crosses Nov 1 cleanly');
x = b('2026-11-01T01:30:00-06:00'); ok(x.batch === '2026-11-05', 'Sun Nov 1 1:30 AM (no repeated hour any more) → Nov 5');
ok(C.edm(T('2026-11-01T08:30:00Z')).h === 2 && C.edm(T('2026-11-01T08:30:00Z')).mi === 30, '08:30 UTC Nov 1 = 2:30 AM Alberta Time (stale data: a second 1:30 AM)');
x = b('2027-03-11T16:00:00-06:00'); ok(x.batch === '2027-03-18' && x.pay === '2027-03-26', 'Thu Mar 11, 2027 4:00 PM → batch Mar 18, pay Fri Mar 26');
x = b('2027-03-18T15:59:00-06:00'); ok(x.batch === '2027-03-18' && !x.rolled, 'Thu Mar 18, 2027 3:59 PM (no spring-forward) → this batch');
x = b('2027-03-18T16:00:00-06:00'); ok(x.batch === '2027-03-25' && x.rolled, 'Thu Mar 18, 2027 4:00 PM → rolls');
ok(C.edm(T('2027-03-14T08:30:00Z')).h === 2, 'Sun Mar 14, 2027 2:30 AM exists (no skipped hour)');
ok(C.at('2027-07-01', 12, 0) === T('2027-07-01T18:00:00Z') && C.at('2026-12-01', 16, 0) === T('2026-12-01T22:00:00Z'), 'wall clock → timestamp uses UTC-6 in winter and summer');
// 5. holidays: a pay Friday that is a stat holiday is flagged, never moved
x = b('2026-12-17T15:00:00-06:00'); ok(x.pay === '2026-12-25' && x.flags.some(f => f.k === 'pay-holiday' && /Christmas/.test(f.name)), `batch Thu Dec 17, 2026 → pay Fri Dec 25 flagged as Christmas Day, date kept (${x.pay})`);
ok(C.noteFor(x).includes('Christmas Day') && C.noteFor(x).includes('not guessed'), 'the note says the pay date is a holiday and that it is not guessed');
x = b('2027-03-18T15:00:00-06:00'); ok(x.pay === '2027-03-26' && x.flags.some(f => f.k === 'pay-holiday' && /Good Friday/.test(f.name)), `batch Thu Mar 18, 2027 → pay Fri Mar 26 = Good Friday (Easter is Mar 28, 2027), flagged (${x.pay})`);
x = b('2026-12-24T15:00:00-06:00'); ok(x.pay === '2027-01-01' && x.flags.some(f => f.k === 'pay-holiday' && /New Year/.test(f.name)), 'batch Thu Dec 24, 2026 → pay Fri Jan 1, 2027 = New Year\'s Day, flagged');
x = b('2027-11-11T10:00:00-06:00'); ok(x.batch === '2027-11-11' && x.flags.some(f => f.k === 'batch-holiday' && /Remembrance/.test(f.name)), 'batch Thursday Nov 11, 2027 = Remembrance Day: flagged, batch kept');
x = b('2026-10-22T15:00:00-06:00'); ok(!x.flags.length, 'an ordinary week has no flags');
x = b('2027-06-24T15:00:00-06:00'); ok(x.pay === '2027-07-02' && !x.flags.some(f => f.k === 'pay-holiday'), 'Fri Jul 2, 2027 (Canada Day is Thu Jul 1; the designated day is not a Friday) → not flagged unless it is a holiday');
x = C.batchFor(T('2026-12-17T15:00:00-06:00'), null); ok(!x.flags.length, 'without a holiday list nothing is flagged (no guessing)');
// 6. permissions (default off; submit needs view)
const s0 = C.seatsOf({ seats: { providers: [{ id: 'p0', name: 'Dr A' }, { id: 'p1', name: 'Dr B' }], staff: [{ id: 's1', name: 'Clerk' }] } });
ok(!C.can(s0, 's1', 'p0', 'view') && !C.can(s0, 's1', 'p0', 'submit'), 'staff: no view, no submit by default');
let r = C.setPerm(s0, 'p0', 's1', 'submit', true); ok(C.can(r.seats, 's1', 'p0', 'view') && C.can(r.seats, 's1', 'p0', 'submit') && r.changes.length === 2, 'granting submit also grants view (2 changes logged)');
ok(!C.can(r.seats, 's1', 'p1', 'view'), 'permission is per provider');
r = C.setPerm(r.seats, 'p0', 's1', 'view', false); ok(!C.can(r.seats, 's1', 'p0', 'submit') && r.changes.length === 2, 'removing view removes submit too');
ok(C.can(s0, 'p0', 'p0', 'submit') && !C.can(s0, 'p1', 'p0', 'view'), 'a provider sees only their own billings');
console.log(fails ? `${fails} of ${n} FAILED` : `ALL PASS (${n})`); process.exit(fails ? 1 : 0);
