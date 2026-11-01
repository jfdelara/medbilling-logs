// QA S3 (2026-10-22): the shared cr-welcome helper auto-skips the Clinical Resources welcome in every other suite, so a
// regression that brings the welcome back would be invisible there. This suite runs with the helper OFF (keepCrWelcome)
// and checks that, after the one first-run dismissal, the welcome does not come back after a Fee Desk pick return, after
// a relock (Lock → unlock) or after reload + unlock. An init script counts every .cro-overlay that appears in the page.
// Run: cd /workspace/pwtest && BASE=http://127.0.0.1:18792/ node /workspace/medbilling-logs/tests/cr-welcome-return-b11.test.js
const { chromium, dismissCrWelcome, NAME_POS } = require('./helpers/cr-welcome');
const BASE = (process.env.BASE || 'http://127.0.0.1:18792/').replace(/\/?$/, '/');
const LOGS = BASE + 'medbilling-logs/', PIN = '48203917';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const G = '#todayList table.grid', cell = (r, c) => `${G} tbody tr:nth-child(${r}) .gc[data-c="${c}"]`;
const pickBtn = (r, k) => `${G} tbody tr:nth-child(${r}) .pickfd[data-kind="${k}"]:not(.fdmini)`;
const COUNT = `(() => { if (!location.pathname.includes('/medbilling-logs/')) return; window.__cro = 0; const seen = new WeakSet();
  const go = () => document.querySelectorAll('.cro-overlay').forEach(o => { if (!seen.has(o)) { seen.add(o); window.__cro++; } });
  const start = () => new MutationObserver(go).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start); })();`;
const shown = async p => p.evaluate(() => [window.__cro || 0, !!document.querySelector('.cro-overlay')]);
const unlock = async p => { await p.waitForSelector('#unlockForm:not([hidden])'); await p.fill('#uPass', PIN); await p.click('#uBtn'); await p.waitForFunction(() => !document.body.classList.contains('locked')); await p.waitForTimeout(1500); };
(async () => {
  const br = await chromium.launch(), errs = [];
  const ctx = await br.newContext({ keepCrWelcome: true, timezoneId: 'America/Edmonton', viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(COUNT);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(LOGS); await p.waitForSelector('#setupForm:not([hidden])');
  await p.check('input[name=sKind][value=pin]'); await p.fill('#sPass', PIN); await p.fill('#sPass2', PIN); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
  await p.waitForFunction(() => !document.body.classList.contains('locked'));
  await dismissCrWelcome(p);
  ok((await shown(p))[0] === 1, `first unlock: the welcome is shown once and dismissed (count ${(await shown(p))[0]})`);
  // a row, then a Fee Desk pick and return
  await p.locator(cell(1, 'name')).click(NAME_POS); await p.keyboard.type('Welcome Return'); await p.keyboard.press('Tab');
  await p.waitForSelector(`${G} tbody tr:nth-child(1)[data-id]`); await p.waitForTimeout(500);
  await p.locator(cell(1, 'fee')).click(); await p.waitForTimeout(150);
  const [fd] = await Promise.all([ctx.waitForEvent('page'), p.locator(pickBtn(1, 'fee')).first().evaluate(b => b.click())]);
  await fd.waitForSelector('#pickbar', { timeout: 10000 });
  await fd.waitForFunction(() => document.querySelector('#results .savedh, #results .hit, #detail .codebig'), null, { timeout: 20000 });
  await fd.fill('#q', '03.03A'); await fd.press('#q', 'Enter'); await fd.waitForSelector('#results .hit[data-code="03.03A"]', { timeout: 10000 });
  const closed = fd.waitForEvent('close', { timeout: 8000 }).then(() => true).catch(() => false);
  await fd.locator('#results .hit[data-code="03.03A"]').first().click(); const c1 = await closed;
  const t = Date.now(); let v = ''; while (Date.now() - t < 8000 && !/03\.03A/.test(v)) { v = await p.inputValue(cell(1, 'fee')).catch(() => ''); await p.waitForTimeout(100); }
  await p.waitForTimeout(1500);
  let s = await shown(p);
  ok(c1 && /03\.03A/.test(v), `pick return completed (Fee Desk closed ${c1}, cell "${v}")`);
  ok(s[0] === 1 && !s[1], `after a pick return the welcome does not come back (count ${s[0]}, visible ${s[1]})`);
  // relock: Lock → unlock in the same page
  await p.click('#lockNow'); await unlock(p); s = await shown(p);
  ok(s[0] === 1 && !s[1], `after Lock → unlock the welcome does not come back (count ${s[0]}, visible ${s[1]})`);
  // reload + unlock (counter restarts with the page)
  await p.reload(); await unlock(p); s = await shown(p);
  ok(s[0] === 0 && !s[1], `after reload + unlock the welcome does not come back (count ${s[0]}, visible ${s[1]})`);
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await br.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL exception: ' + e.message); process.exit(1); });
