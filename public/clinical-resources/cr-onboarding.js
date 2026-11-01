/* First sign-in form (onboarding option 1): 3 steps, skippable, editable in Settings. Preferences only, no PHI.
   Usage: CROnboarding.open({ store, app, billingRole, codePrefs: true, edit: false, onDone(profile|null) }) */
(function (root) {
  'use strict';
  const C = root.CRCore;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const PROV = { AB: 'Alberta', BC: 'British Columbia', SK: 'Saskatchewan', MB: 'Manitoba', ON: 'Ontario', QC: 'Quebec', NB: 'New Brunswick', NS: 'Nova Scotia', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador', YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut' };
  const CATS = ['guidelines-society', 'point-of-care', 'research-database', 'journal', 'patient-counselling', 'drug-database', 'antimicrobial-guidance', 'regulator'];
  function open(o) {
    const store = o.store, prev = store.get('onboarding_profile') || {}, br = o.billingRole || {};
    const A = { provider_type: prev.provider_type || br.provider_type || 'physician', specialty: prev.specialty || br.specialty || 'all', province: prev.province || 'AB', categories: prev.categories || [], language: prev.language || 'en', show_subscription: prev.show_subscription !== false, code_set: (prev.code_prefs && prev.code_prefs.code_set) || prev.province || 'AB', fav_codes: ((prev.code_prefs && prev.code_prefs.favourite_codes) || []).join(', ') };
    let step = 1;
    const last = document.activeElement;
    const ov = document.createElement('div'); ov.className = 'cro-overlay';
    ov.innerHTML = `<div class="cro" role="dialog" aria-modal="true" aria-labelledby="cro-t"><div class="cro-in"></div></div>`;
    document.body.appendChild(ov);
    const box = ov.querySelector('.cro-in');
    const sel = (name, list, v, lab) => `<label class="cro-f"><span>${lab}</span><select name="${name}">${list.map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    function draw() {
      const pct = Math.round(step / 3 * 100);
      let body = '';
      if (step === 1) body = `<p class="cro-lead">This sets your defaults, such as the Clinical Resources view. About 30 seconds. You can change it any time in Settings.</p>
        ${sel('provider_type', C.PROVIDER_TYPES.filter(x => x[0] !== 'all'), A.provider_type, 'Provider type')}
        <div class="cro-spwrap">${sel('specialty', C.SPECIALTIES, A.specialty, 'Specialty')}</div>
        ${sel('province', Object.entries(PROV), A.province, 'Province')}`;
      if (step === 2) body = `<fieldset class="cro-f"><legend>Favourite resource categories <small>(optional)</small></legend><div class="cro-grid">${CATS.map(k => `<label class="cro-c"><input type="checkbox" name="cat" value="${k}"${A.categories.includes(k) ? ' checked' : ''}> ${esc(C.CATEGORIES[k])}</label>`).join('')}</div></fieldset>
        ${o.codePrefs ? `${sel('code_set', Object.entries(PROV), A.code_set, 'Default fee code set')}<label class="cro-f"><span>Favourite fee codes <small>(optional, comma separated)</small></span><input name="fav_codes" value="${esc(A.fav_codes)}" placeholder="e.g. 03.03A, 03.04A" autocomplete="off" spellcheck="false" maxlength="200"></label>` : ''}
        ${sel('language', [['en', 'English'], ['fr', 'Français']], A.language, 'Language')}
        <label class="cro-c cro-sw"><input type="checkbox" name="show_subscription"${A.show_subscription ? ' checked' : ''}> Show subscription resources (labelled "Subscription required")</label>`;
      if (step === 3) body = `<p class="cro-lead">Check your choices:</p><dl class="cro-sum">
        <dt>Provider type</dt><dd>${esc(C.label(C.PROVIDER_TYPES, A.provider_type))}</dd>
        ${['physician', 'np', 'midwife'].includes(A.provider_type) ? `<dt>Specialty</dt><dd>${esc(C.label(C.SPECIALTIES, A.specialty))}</dd>` : ''}
        <dt>Province</dt><dd>${esc(PROV[A.province])}</dd>
        <dt>Categories</dt><dd>${A.categories.length ? A.categories.map(k => esc(C.CATEGORIES[k])).join(', ') : 'All'}</dd>
        ${o.codePrefs ? `<dt>Fee codes</dt><dd>${esc(A.code_set)}${A.fav_codes ? ' · ' + esc(A.fav_codes) : ''}</dd>` : ''}
        <dt>Language</dt><dd>${A.language === 'fr' ? 'Français' : 'English'}</dd>
        <dt>Subscription resources</dt><dd>${A.show_subscription ? 'Shown, labelled' : 'Hidden'}</dd></dl><p class="cro-note">Preferences only. No patient information is collected.</p>`;
      box.innerHTML = `<h2 id="cro-t">${o.edit ? 'Profile &amp; defaults' : 'Welcome! Set up your defaults'}</h2>
        <div class="cro-prog" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${step}" aria-label="Step ${step} of 3"><i></i></div>
        <p class="cro-step">Step ${step} of 3 · ${['Who you are', 'Preferences', 'Confirm'][step - 1]}</p>
        <form class="cro-form" novalidate>${body}
        <div class="cro-btns">${o.edit ? '<button type="button" class="cro-cancel cro-ghost">Cancel</button>' : '<button type="button" class="cro-skip cro-ghost">Skip – use defaults</button>'}<span class="cro-gap"></span>${step > 1 ? '<button type="button" class="cro-back cro-ghost">Back</button>' : ''}<button type="submit" class="cro-next">${step === 3 ? 'Done' : 'Next'}</button></div></form>`;
      box.querySelector('.cro-prog i').style.width = pct + '%';
      const ptS = box.querySelector('[name=provider_type]'); if (ptS) { const sw = () => { box.querySelector('.cro-spwrap').hidden = !['physician', 'np', 'midwife'].includes(ptS.value); }; ptS.addEventListener('change', sw); sw(); }
      const f = box.querySelector('select, input, button.cro-next'); if (f) f.focus();
    }
    function read() {
      const fm = box.querySelector('form'), v = n => { const e = fm.elements[n]; return e ? e.value : undefined; };
      if (step === 1) { A.provider_type = v('provider_type'); A.specialty = ['physician', 'np', 'midwife'].includes(A.provider_type) ? v('specialty') : 'all'; A.province = v('province'); if (!fm.elements.code_set) A.code_set = A.province; }
      if (step === 2) { A.categories = [...fm.querySelectorAll('[name=cat]:checked')].map(x => x.value); if (fm.elements.code_set) A.code_set = v('code_set'); if (fm.elements.fav_codes) A.fav_codes = v('fav_codes'); A.language = v('language'); A.show_subscription = fm.elements.show_subscription.checked; }
    }
    function close(result) { ov.remove(); document.removeEventListener('keydown', onKey, true); if (last && last.focus) last.focus(); o.onDone && o.onDone(result); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); o.edit ? close(null) : skip(); }
      if (e.key === 'Tab') { const fs = [...box.querySelectorAll('select, input, button, [tabindex]')].filter(x => !x.disabled && x.offsetParent); if (!fs.length) return; const a = fs[0], z = fs[fs.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    }
    function skip() { C.skipOnboarding(store); close(null); }
    document.addEventListener('keydown', onKey, true);
    box.addEventListener('submit', e => {
      e.preventDefault(); read();
      if (step < 3) { step++; draw(); return; }
      const codes = A.fav_codes.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(s => /^[A-Z0-9.]{2,10}$/.test(s)).slice(0, 20);
      const p = C.makeProfile({ provider_type: A.provider_type, specialty: A.specialty, province: A.province, categories: A.categories, code_prefs: o.codePrefs ? { code_set: A.code_set, favourite_codes: codes } : null, language: A.language, show_subscription: A.show_subscription }, o.app);
      if (!o.codePrefs) p.code_prefs = null;
      C.applyProfile(store, p); close(p);
    });
    box.addEventListener('click', e => {
      if (e.target.closest('.cro-skip')) skip();
      else if (e.target.closest('.cro-cancel')) close(null);
      else if (e.target.closest('.cro-back')) { read(); step--; draw(); }
    });
    draw();
    return { close };
  }
  // First-run hook: shows the form, or a one-time re-prompt banner 7 days after a skip.
  function maybeStart(o) {
    const st = C.onboardingState(o.store);
    if (st === 'show') return open(o);
    if (st === 'banner' && o.bannerHost) {
      C.markReprompted(o.store);
      const b = document.createElement('div'); b.className = 'cro-banner'; b.setAttribute('role', 'status');
      b.innerHTML = 'Set your provider type and specialty so resources open to your own view. <button type="button" class="cro-b-go">Set up</button> <button type="button" class="cro-b-x" aria-label="Dismiss">×</button>';
      b.addEventListener('click', e => { if (e.target.closest('.cro-b-go')) { b.remove(); open(o); } else if (e.target.closest('.cro-b-x')) b.remove(); });
      o.bannerHost.prepend(b);
    }
    return null;
  }
  root.CROnboarding = { open, maybeStart };
})(typeof self !== 'undefined' ? self : this);
