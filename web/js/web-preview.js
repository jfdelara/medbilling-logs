/* Free /web/ preview timer for MedBilling Logs.
   Owner knobs (turn off or pull /web/ early without waiting for the date):
     WEB_PREVIEW_ENABLED  — set false to freeze /web/ immediately (expired notice + local export only)
     WEB_PREVIEW_EXPIRES_AT — ISO timestamp; preview freezes at this instant
   To remove /web/ entirely: stop copying public/ into the published web/ folder
   (see scripts/ci/cf-bundle.py) and drop this file + css/web-preview.css from the app shell.
   Test hook: ?wp_now=2027-05-25T00:00:00-06:00 simulates "now" (verification only). */
(function (g) {
  'use strict';
  var WEB_PREVIEW_ENABLED = true;
  var WEB_PREVIEW_EXPIRES_AT = '2027-05-24T00:00:00-06:00';
  var APPS = 'https://medibrisa.com/#apps';
  var MAIL = 'admin@medibrisa.com';

  function isWebPreviewPath(pathname) {
    var p = String(pathname == null ? ((g.location && g.location.pathname) || '') : pathname);
    p = p.replace(/\/index\.html$/i, '');
    return /(?:^|\/)web\/?$/.test(p);
  }
  function nowMs(search, fallback) {
    try {
      var q = new URLSearchParams(search == null ? ((g.location && g.location.search) || '') : search).get('wp_now');
      if (q) { var t = Date.parse(q); if (!isNaN(t)) return t; }
    } catch (e) { /* ignore */ }
    return fallback != null ? fallback : Date.now();
  }
  function expired(opts) {
    opts = opts || {};
    var enabled = opts.enabled != null ? opts.enabled : WEB_PREVIEW_ENABLED;
    if (!enabled) return true;
    var cut = Date.parse(opts.expiresAt != null ? opts.expiresAt : WEB_PREVIEW_EXPIRES_AT);
    if (isNaN(cut)) return true;
    var n = opts.now != null ? opts.now : nowMs();
    return n >= cut;
  }
  function frozen() { return isWebPreviewPath() && expired(); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function link(href, text, cls) {
    var a = el('a', cls || ''); a.href = href; a.textContent = text;
    a.rel = 'noopener noreferrer';
    if (/^https?:/i.test(href)) { a.target = '_blank'; a.referrerPolicy = 'no-referrer'; }
    return a;
  }
  function para() {
    var p = el('p');
    for (var i = 0; i < arguments.length; i++) {
      var x = arguments[i];
      p.appendChild(typeof x === 'string' ? document.createTextNode(x) : x);
    }
    return p;
  }

  function triggerExport() {
    var b = document.getElementById('expAll');
    if (b) { b.click(); return; }
    if (g.MBMove && typeof g.MBMove.doExport === 'function') { g.MBMove.doExport(); return; }
  }

  function mountBanner() {
    var old = document.getElementById('wpBanner'); if (old) old.remove();
    var bar = el('div', 'wp-banner'); bar.id = 'wpBanner'; bar.setAttribute('role', 'note');
    bar.appendChild(para(
      'Free temporary web preview through May 23, 2027. Entries stay in this browser and can be exported anytime. ',
      link(APPS, 'Get the app')
    ));
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function mountExpired() {
    var old = document.getElementById('wpExpired'); if (old) old.remove();
    var box = el('div', 'wp-expired'); box.id = 'wpExpired'; box.setAttribute('role', 'status');
    var inner = el('div', 'wp-expired-card');
    inner.appendChild(el('h2', '', 'This free web preview has ended'));
    inner.appendChild(para(
      'The MedBilling Logs browser preview ended after May 23, 2027. Creating and editing log entries is turned off. Entries already stored in this browser stay here until you export or clear site data.'
    ));
    inner.appendChild(para('Get the app at ', link(APPS, 'medibrisa.com'), '.'));
    inner.appendChild(para('Support: ', link('mailto:' + MAIL, MAIL), '.'));
    var exp = el('button', 'wp-export', 'Export / back up local entries');
    exp.type = 'button'; exp.id = 'wpExport';
    exp.addEventListener('click', function () {
      if (document.body.classList.contains('locked')) {
        var msg = document.getElementById('lockMsg');
        if (msg) msg.textContent = 'Unlock first, then tap Export / back up local entries.';
        var u = document.getElementById('uPass'); if (u) u.focus();
        return;
      }
      triggerExport();
    });
    inner.appendChild(exp);
    inner.appendChild(el('p', 'wp-muted', 'Unlock if asked. Export saves an encrypted backup of what this browser stored. Medibrisa cannot recover a lost passcode.'));
    box.appendChild(inner);
    document.body.insertBefore(box, document.body.firstChild);
  }

  function apply() {
    if (!isWebPreviewPath()) return;
    document.documentElement.classList.add('wp-preview');
    var dead = expired();
    document.documentElement.classList.toggle('wp-expired', dead);
    var ban = document.getElementById('wpBanner'); if (ban) ban.remove();
    var ex = document.getElementById('wpExpired'); if (ex) ex.remove();
    if (dead) {
      mountExpired();
      var setup = document.getElementById('setupForm');
      if (setup) setup.hidden = true;
    } else mountBanner();
  }

  var api = {
    ENABLED: WEB_PREVIEW_ENABLED,
    EXPIRES_AT: WEB_PREVIEW_EXPIRES_AT,
    APPS: APPS,
    MAIL: MAIL,
    isWebPreviewPath: isWebPreviewPath,
    expired: expired,
    frozen: frozen,
    nowMs: nowMs,
    apply: apply
  };
  g.MBWebPreview = api;
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})(typeof window !== 'undefined' ? window : globalThis);
