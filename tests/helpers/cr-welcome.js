// Shared test helper: the Clinical Resources first-run welcome ("Welcome! Set up your defaults", .cro-overlay)
// opens ~600 ms after the first unlock and sits over the app (z-index 10000), so older browser tests that predate it
// time out on clicks. This loads Playwright from /workspace/pwtest and adds an init script to every new context that
// presses "Skip – use defaults" whenever the welcome appears (the same thing a user does). App code is not changed.
// Opt out per context with newContext({ ..., keepCrWelcome: true }) for tests that check the welcome itself.
const pw = require(require.resolve('playwright', { paths: ['/workspace/pwtest'] }));
const SKIP = `(() => {
  const go = () => { const b = document.querySelector('.cro-overlay .cro-skip'); if (b) b.click(); };
  const start = () => new MutationObserver(go).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
})();`;
const patched = new WeakSet();
function patch(bt) {
  if (patched.has(bt)) return bt; patched.add(bt);
  const launch = bt.launch.bind(bt);
  bt.launch = async (...a) => {
    const b = await launch(...a), nc = b.newContext.bind(b);
    b.newContext = async (o = {}) => {
      const { keepCrWelcome, ...rest } = o; const c = await nc(rest);
      if (!keepCrWelcome) await c.addInitScript(SKIP);
      return c;
    };
    b.newPage = async (o) => { const c = await b.newContext(o); const p = await c.newPage(); p.on('close', () => c.close().catch(() => {})); return p; };
    return b;
  };
  return bt;
}
[pw.chromium, pw.webkit, pw.firefox].forEach(patch);
// Wait for the welcome and dismiss it explicitly (for contexts opened with keepCrWelcome: true).
async function dismissCrWelcome(page, timeout = 5000) {
  const ov = page.locator('.cro-overlay');
  await ov.waitFor({ state: 'visible', timeout });
  await ov.locator('.cro-skip').click();
  await ov.waitFor({ state: 'detached', timeout });
}
module.exports = Object.assign({}, pw, { chromium: pw.chromium, webkit: pw.webkit, firefox: pw.firefox, dismissCrWelcome, CR_WELCOME_SKIP_SCRIPT: SKIP });
// b11: on a computer the 📷 scan and ↗ entry-window buttons appear over the right part of the (81 px) name cell on hover,
// covering its centre. Click / tap the name cell in its text area, left of those buttons.
const NAME_POS = { position: { x: 8, y: 8 } };
module.exports.NAME_POS = NAME_POS;
// b11: on a phone, a tap on an EMPTY Name / MRN / Sex cell opens a small "📷 Scan with camera / ⌨ Type it" menu first
// (by design). Older tests that tap then type pick "Type it", as a user who wants to type would.
async function pickTypeIfScanMenu(page) {
  if (page.isClosed()) return false;   // the tap may close a pick-mode popup
  try {
    const t = page.locator('.scanmenu [data-m="type"]');
    if (await t.count() && await t.first().isVisible()) { await t.first().tap().catch(() => t.first().click()); await page.waitForTimeout(80); return true; }
  } catch (e) { if (!page.isClosed() && !/has been closed/.test(e.message)) throw e; }
  return false;
}
module.exports.pickTypeIfScanMenu = pickTypeIfScanMenu;
