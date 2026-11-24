// Node tests for public/js/web-preview.js (no browser). Run: node tests/web-preview.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'web-preview.js'), 'utf8');
function load() {
  const g = { Date, URLSearchParams, console };
  vm.runInNewContext(src, g);
  return g.MBWebPreview;
}
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const W = load();
ok(W.ENABLED === true, 'WEB_PREVIEW_ENABLED is true');
ok(W.EXPIRES_AT === '2027-05-24T00:00:00-06:00', 'expiry is 2027-05-24T00:00:00-06:00');
ok(W.MAIL === 'admin@medibrisa.com', 'public contact is admin@medibrisa.com');
ok(W.APPS === 'https://medibrisa.com/#apps', 'apps link is medibrisa.com/#apps');
ok(W.isWebPreviewPath('/web/'), '/web/ is a preview path');
ok(W.isWebPreviewPath('/web'), '/web is a preview path');
ok(W.isWebPreviewPath('/web/index.html'), '/web/index.html is a preview path');
ok(W.isWebPreviewPath('/medbilling-logs/web/'), 'GitHub Pages /web/ is a preview path');
ok(!W.isWebPreviewPath('/medbilling-logs/'), 'test harness /medbilling-logs/ is not a preview path');
ok(!W.isWebPreviewPath('/export/'), 'legacy /export/ is not a preview path');
ok(!W.isWebPreviewPath('/'), 'landing / is not a preview path');
const cut = Date.parse(W.EXPIRES_AT);
ok(!isNaN(cut), 'expiry parses');
ok(!W.expired({ now: Date.parse('2026-11-24T12:00:00-07:00') }), 'before expiry is not expired');
ok(W.expired({ now: Date.parse('2027-05-24T00:00:00-06:00') }), 'cutoff instant is expired');
ok(W.expired({ now: Date.parse('2027-05-25T12:00:00-06:00') }), 'May 25 2027 is expired');
ok(W.expired({ enabled: false, now: Date.parse('2026-11-24T12:00:00-07:00') }), 'ENABLED=false is expired immediately');
ok(W.nowMs('?wp_now=2027-05-25T00:00:00-06:00') === Date.parse('2027-05-25T00:00:00-06:00'), 'wp_now query override');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
ok(/css\/web-preview\.css/.test(html) && /js\/web-preview\.js/.test(html), 'index.html loads web-preview css and js');
ok(!/Jose|jfdelara|780-|Dr\. Jose/i.test(src), 'web-preview.js has no personal name/phone');
console.log(fails ? 'FAILS ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
