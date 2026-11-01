/* MedBilling Logs - claims timing (H-Link batch rules), seats and permissions, weekly (Thursday) report. Pure logic, no DOM,
   no storage, no network: app.js keeps everything in the encrypted vault. H-Link is NOT connected: "Queued for H-Link"
   only marks a claim as approved and waiting for a batch; nothing is ever sent.
   Rules (Jose, 2026-10-15, following H-Link): processing Tuesday to Thursday, submission cutoff Thursday 4:30 PM
   (America/Edmonton), payment the following Friday. Provider approvals close 30 minutes earlier (Thursday 4:00 PM); an
   approval at or after 4:00 PM Thursday rolls to the next Thursday's batch. A pay Friday (or a batch Thursday) that is a
   statutory / designated holiday is flagged, never moved: Alberta Health publishes the actual schedule. */
(function (global) {
  'use strict';
  const RULES = { tz: 'America/Edmonton', batchWd: 4, approveH: 16, approveM: 0, submitH: 16, submitM: 30, payLagDays: 8, procFrom: 2, procTo: 4 };
  const pad = n => String(n).padStart(2, '0');
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let fmt = null;
  try { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: RULES.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' }); } catch (e) { fmt = null; }
  // Alberta Time: permanent UTC-6 from Nov 1, 2026 02:00 (08:00 UTC; IANA tzdata 2026c). On a browser whose zone data is older
  // (still falls back to UTC-7), times from the cutover on are computed as fixed UTC-6 so the Thursday 4:00 / 4:30 PM cutoffs hold.
  const AB_PERM = Date.UTC(2026, 10, 1, 8, 0, 0);
  let stale = true; try { stale = !fmt || +fmt.formatToParts(new Date(Date.UTC(2027, 0, 15, 18))).find(p => p.type === 'hour').value % 24 !== 12; } catch (e) { stale = true; }
  function edm(t) {   // wall-clock parts in America/Edmonton
    if (stale && t >= AB_PERM) { const d = new Date(t - 6 * 3600000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay(), key: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }; }
    if (!fmt) { const d = new Date(t); return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), wd: d.getDay(), key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }; }
    const o = {}; for (const p of fmt.formatToParts(new Date(t))) o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, wd: WD.indexOf(o.weekday), key: `${o.year}-${o.month}-${o.day}` };
  }
  const keyParts = k => k.split('-').map(Number);
  function addDays(k, n) { const [y, m, d] = keyParts(k), t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
  const wdOf = k => { const [y, m, d] = keyParts(k); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  // wall-clock h:mi on an Edmonton day → timestamp (tries UTC-6 first: Alberta Time from Nov 1, 2026; then the old MST/MDT offsets)
  function at(k, h, mi) {
    const [y, mo, d] = keyParts(k), base = Date.UTC(y, mo - 1, d, h, mi);
    for (const off of [6, 7, 5, 8]) { const t = base + off * 3600000, w = edm(t); if (w.key === k && w.h === h && w.mi === mi) return t; }
    return new Date(y, mo - 1, d, h, mi).getTime();
  }
  const dayTxt = k => { const [y, m, d] = keyParts(k); return `${WD[wdOf(k)]} ${MON[m - 1]} ${d}, ${y}`; };
  const shortDay = k => { const [, m, d] = keyParts(k); return `${WD[wdOf(k)]} ${MON[m - 1]} ${d}`; };
  const rangeTxt = (a, b) => { const [ya, ma, da] = keyParts(a), [yb, mb, db] = keyParts(b); return ma === mb ? `${MON[ma - 1]} ${da}–${db}, ${yb}` : ya === yb ? `${MON[ma - 1]} ${da} – ${MON[mb - 1]} ${db}, ${yb}` : `${MON[ma - 1]} ${da}, ${ya} – ${MON[mb - 1]} ${db}, ${yb}`; };
  const clock = (h, mi) => `${h % 12 || 12}:${pad(mi)} ${h < 12 ? 'AM' : 'PM'}`;
  const APPROVE_TXT = clock(RULES.approveH, RULES.approveM), SUBMIT_TXT = clock(RULES.submitH, RULES.submitM);
  // the batch a claim approved at time t goes into. holName(key) → holiday name or '' (report.js holidayName).
  function batchFor(t, holName) {
    const w = edm(t), toThu = (RULES.batchWd - w.wd + 7) % 7;
    let thu = addDays(w.key, toThu), rolled = false;
    const mins = w.h * 60 + w.mi, close = RULES.approveH * 60 + RULES.approveM;
    if (toThu === 0 && mins >= close) { thu = addDays(thu, 7); rolled = true; }
    return batchOf(thu, holName, rolled);
  }
  function batchOf(thu, holName, rolled) {
    const pay = addDays(thu, RULES.payLagDays), procFrom = addDays(thu, RULES.procFrom - RULES.batchWd), hn = holName || (() => '');
    const flags = [];
    const ph = hn(pay); if (ph) flags.push({ k: 'pay-holiday', day: pay, name: ph, txt: `Expected pay date ${dayTxt(pay)} is ${ph}. Alberta Health may pay on another day: check the AHCIP payment schedule (not guessed here).` });
    const th = hn(thu); if (th) flags.push({ k: 'batch-holiday', day: thu, name: th, txt: `Batch Thursday ${dayTxt(thu)} is ${th}. H-Link processing may differ that week: check the H-Link / AHCIP schedule (not guessed here).` });
    return { batch: thu, closeAt: at(thu, RULES.approveH, RULES.approveM), submitAt: at(thu, RULES.submitH, RULES.submitM), pay, procFrom, rolled: !!rolled, flags,
      weekTxt: rangeTxt(procFrom, thu), batchTxt: dayTxt(thu), payTxt: dayTxt(pay) };
  }
  // one plain sentence for the row / toast
  function noteFor(b) {
    const base = `Queued for H-Link: batch of ${b.weekTxt} (approvals close ${shortDay(b.batch)} ${APPROVE_TXT}, submission cutoff ${SUBMIT_TXT}). Expected pay ${b.payTxt}.`;
    return (b.rolled ? `Approved after the Thursday ${APPROVE_TXT} cutoff, so it rolls to the next batch. ` : '') + base + (b.flags.length ? ' ⚠ ' + b.flags.map(f => f.txt).join(' ') : '');
  }
  // the batch that is open for approvals right now (same as batchFor(now)); and the one that closed most recently
  const openBatch = (now, hn) => batchFor(now, hn);
  // ---- seats and permissions. settings.seats = { providers: [{id, name}], staff: [{id, name, role}], perm: {"p|s": {view, submit}}, active }
  function seatsOf(s, ownerName) {
    const x = s && s.seats && typeof s.seats === 'object' ? s.seats : {};
    const providers = Array.isArray(x.providers) && x.providers.length ? x.providers : [{ id: 'p0', name: ownerName || 'Provider (this device)' }];
    return { providers, staff: Array.isArray(x.staff) ? x.staff : [], perm: x.perm && typeof x.perm === 'object' ? x.perm : {}, active: x.active || providers[0].id };
  }
  const isProvider = (seats, id) => seats.providers.some(p => p.id === id);
  const permOf = (seats, prov, staff) => { const p = seats.perm[prov + '|' + staff] || {}; return { view: p.view === true, submit: p.submit === true }; };   // default: off
  function can(seats, seatId, prov, what) {   // what: 'view' | 'submit'
    if (isProvider(seats, seatId)) return seatId === prov;   // a provider sees and approves their own billings
    const st = seats.staff.find(x => x.id === seatId); if (!st) return false;
    const p = permOf(seats, prov, seatId); return what === 'view' ? p.view : p.submit && p.view;
  }
  const provOfEntry = (e, seats) => (e && e.prv) || seats.providers[0].id;   // older entries belong to the first provider (this device's owner)
  // set a permission; returns { seats, changes: [{what, from, to}] }. Submit needs view: turning submit on turns view on, view off turns submit off.
  function setPerm(seats, prov, staff, what, on) {
    const k = prov + '|' + staff, cur = permOf(seats, prov, staff), nx = Object.assign({}, cur);
    nx[what] = !!on; if (what === 'submit' && on) nx.view = true; if (what === 'view' && !on) nx.submit = false;
    const changes = ['view', 'submit'].filter(w => cur[w] !== nx[w]).map(w => ({ what: w, from: cur[w], to: nx[w] }));
    const perm = Object.assign({}, seats.perm, { [k]: nx });
    return { seats: Object.assign({}, seats, { perm }), changes };
  }
  // ---- claim state on an entry: e.claim = { st: 'queued', at, by, byName, onBehalf, batch, pay, rolled, flags }
  const queued = e => !!(e && e.claim && e.claim.st === 'queued');
  // what the weekly report counts: 'done' (approved / queued), 'approve' (complete, waiting for approval), 'todo' (something missing)
  function missingOf(e) {
    const m = [], codes = (e.codes || []).filter(c => c && c.c);
    if (!codes.length) m.push('fee code');
    if (codes.length && !codes.every(c => c.dx) && !e.dx) m.push('ICD-9');
    if (!String(e.mrn || e.chart || '').trim()) m.push('ULI / PHN');
    if (!(e.segs || []).length) m.push('In time'); else if (e.status === 'run' || e.status === 'pause') m.push('Out time');
    return m;
  }
  // b11: AHS claim forms need Sex (e.ma.sex: M, F, X or U). A non-blocking warning: not in missingOf, so approval is never held.
  const SEXES = { M: 1, F: 1, X: 1, U: 1 };
  const sexMissing = e => !SEXES[String((e && e.ma && e.ma.sex) || '').toUpperCase()];
  const warnOf = e => sexMissing(e) ? ['Sex'] : [];
  const stateOf = e => queued(e) ? 'done' : missingOf(e).length ? 'todo' : 'approve';
  // report for the batch whose Thursday is `thu`: entries with a service day in the 7 days up to that Thursday (Fri–Thu),
  // plus anything queued into that batch. dayOf(e) → Edmonton day key; payOf(e) → expected $ (estimate) or null.
  function weekReport(o) {
    const { thu, encs, seats, seatId, dayOf, payOf, holName } = o, from = addDays(thu, -6), b = batchOf(thu, holName, false);
    const provs = seats.providers.filter(p => can(seats, seatId, p.id, 'view'));
    const rows = provs.map(p => {
      const mine = encs.filter(e => e.kind !== 'shift' && provOfEntry(e, seats) === p.id && ((dayOf(e) >= from && dayOf(e) <= thu) || (queued(e) && e.claim.batch === thu)));
      const g = { done: [], approve: [], todo: [] }; mine.forEach(e => g[stateOf(e)].push(e));
      const sum = l => l.reduce((a, e) => { const v = payOf(e); return a + (v || 0); }, 0);
      const inBatch = g.done.filter(e => e.claim.batch === thu);
      return { prov: p, done: g.done, approve: g.approve, todo: g.todo, total: sum(mine), queuedTotal: sum(inBatch), queuedN: inBatch.length, laterN: g.done.length - inBatch.length };
    });
    return { thu, from, batch: b, rows, rangeTxt: rangeTxt(from, thu) };
  }
  global.MBClaims = { RULES, edm, at, addDays, wdOf, dayTxt, shortDay, rangeTxt, batchFor, batchOf, noteFor, openBatch, APPROVE_TXT, SUBMIT_TXT,
    seatsOf, isProvider, permOf, can, setPerm, provOfEntry, queued, missingOf, stateOf, sexMissing, warnOf, weekReport };
})(typeof window !== 'undefined' ? window : globalThis);
