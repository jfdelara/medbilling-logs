// ENC-1 regression (b11): the Clinical Resources welcome must not open while the user is typing in the grid
// right after the first unlock (it stole focus 600 ms after unlock and dropped keystrokes → "Sample, Maria" saved as "ample, Maria").
// Run: cd /workspace/pwtest && URL=http://127.0.0.1:18791/medbilling-logs/ node tests/welcome-typing-enc1.test.js
const { chromium, NAME_POS } = require('./helpers/cr-welcome');
const URL = process.env.URL || 'http://127.0.0.1:18791/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const lag of [200, 400, 550]) {          // start typing at different moments around the old 600 ms timer
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Edmonton' });
    await ctx.addInitScript(() => { window.__steal = 0; document.addEventListener('focusin', e => { if (e.target.closest && e.target.closest('.cro-overlay') && window.__typing) window.__steal++; }, true); });
    const p = await ctx.newPage(); await p.goto(URL); await p.waitForSelector('#setupForm:not([hidden])');
    const P = 'Quiet harbor seventy lantern';
    await p.check('input[name=sKind][value=phrase]'); await p.fill('#sPass', P); await p.fill('#sPass2', P); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 30000 }); await p.waitForTimeout(lag);
    await p.click('#todayList table.grid tbody tr:nth-child(1) .gc[data-c="name"]', NAME_POS);
    await p.evaluate(() => { window.__typing = 1; });
    await p.keyboard.type('Sample, Maria', { delay: 60 });            // ~0.8 s of typing straddling the old timer
    await p.evaluate(() => { window.__typing = 0; });
    await p.keyboard.press('Tab'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const name = await p.$eval('#todayList table.grid tbody tr:nth-child(1) .gc[data-c="name"]', e => (e.value || e.textContent).trim());
    ok(name === 'Sample, Maria', `lag ${lag} ms: name kept in full (${JSON.stringify(name)})`);
    ok(await p.evaluate(() => window.__steal) === 0, `lag ${lag} ms: welcome never took focus while typing`);
    await ctx.close();
  }
  // the welcome still appears on first unlock when the user is idle (not typing)
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Edmonton' });
    await ctx.addInitScript(() => { window.__cro = 0; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList && n.classList.contains('cro-overlay')) window.__cro++; }).observe(document, { childList: true, subtree: true }); });
    const p = await ctx.newPage(); await p.goto(URL); await p.waitForSelector('#setupForm:not([hidden])');
    const P = 'Quiet harbor seventy lantern';
    await p.check('input[name=sKind][value=phrase]'); await p.fill('#sPass', P); await p.fill('#sPass2', P); await p.check('#sAck'); await p.check('#sResp'); await p.click('#sBtn');
    await p.waitForFunction(() => !document.body.classList.contains('locked'), null, { timeout: 30000 });
    const t0 = Date.now(); await p.waitForFunction(() => window.__cro > 0, null, { timeout: 5000 }).catch(() => {});
    ok(await p.evaluate(() => window.__cro) === 1, `idle user: the welcome appears once after first unlock (${Date.now() - t0} ms)`);
    await ctx.close(); }
  await b.close(); console.log(fails ? `${fails} FAILURE(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
