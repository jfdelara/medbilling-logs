/* MedBilling Logs: Clinical Resources drawer (toolbar 📚 or R) + onboarding after first unlock (Phase 1, Option A).
   Stores preferences only (provider type, specialty, province, favourites); no PHI, no network. logs-billing: kept in the
   app's encrypted settings through window.__mblPrefStore (app.js), never in plaintext localStorage. */
(function () {
  'use strict';
  if (!self.CRCore || !self.CRPanel || !self.CR_REGISTRY) return;
  const store = CRCore.LocalAppSettingsStore('bl.cr', window.__mblPrefStore || { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const $ = id => document.getElementById(id), drawer = $('crDrawer'), btn = $('crOpen');
  const billingRole = { provider_type: 'physician', specialty: 'all' };
  let panel = null;
  const mount = () => { if (panel) panel.destroy(); panel = CRPanel.mount($('crMount'), { registry: self.CR_REGISTRY, store, app: 'medbilling-logs', layout: 'drawer', billingRole }); };
  let lastFocus = null;
  function openD() { if (!panel) mount(); lastFocus = document.activeElement; drawer.hidden = false; btn && btn.setAttribute('aria-expanded', 'true'); const q = drawer.querySelector('.crp-q'); if (q) q.focus(); }
  function closeD() { drawer.hidden = true; btn && btn.setAttribute('aria-expanded', 'false'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  btn && btn.addEventListener('click', () => drawer.hidden ? openD() : closeD());
  $('crClose').addEventListener('click', closeD);
  drawer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeD(); } });
  document.addEventListener('keydown', e => {
    if ((e.key !== 'r' && e.key !== 'R') || e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains('locked')) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t.closest && t.closest('table.grid'))) || document.querySelector('dialog[open], .cro-overlay')) return;
    e.preventDefault(); drawer.hidden ? openD() : closeD();   // b11: never over the grid — a selected cell (e.g. Billing notes) takes typed letters
  });
  const edit = () => CROnboarding.open({ store, app: 'medbilling-logs', billingRole, codePrefs: true, edit: true, onDone: p => { if (p) mount(); } });
  $('crProfile').addEventListener('click', edit);
  // Onboarding: once, after the first unlock (never over the lock screen). The drawer closes when the app locks.
  let started = false;
  // ENC-1: never open the welcome while the user is typing/editing (it steals focus and drops keystrokes)
  let lastKey = 0; document.addEventListener('keydown', () => { lastKey = Date.now(); }, true);
  const busy = () => { const a = document.activeElement; return Date.now() - lastKey < 1500 || (a && a !== document.body && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable || (a.closest && a.closest('table.grid')))) || document.querySelector('dialog[open]'); };
  const whenIdle = fn => { const t = () => { if (document.body.classList.contains('locked')) { started = false; return; } busy() ? setTimeout(t, 1000) : fn(); }; setTimeout(t, 600); };
  const check = () => {
    const locked = document.body.classList.contains('locked');
    if (locked && !drawer.hidden) closeD();
    if (!locked && !started) { started = true; whenIdle(() => CROnboarding.maybeStart({ store, app: 'medbilling-logs', billingRole, codePrefs: true, bannerHost: document.querySelector('main') || document.body, onDone: p => { if (p) mount(); } })); }
  };
  new MutationObserver(check).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  check();
})();
