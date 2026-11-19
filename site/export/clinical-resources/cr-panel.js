/* Clinical Resources panel (Phase 1). Link-only: every link opens the resource's home page in a new tab.
   Usage: CRPanel.mount(el, { registry, store, app, layout: 'page'|'drawer', billingRole }) */
(function (root) {
  'use strict';
  const C = root.CRCore;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const DISCLAIMER = 'External sites; link only; not endorsed; verify clinically.';
  const ACCESS = { subscription: 'Subscription required', member: 'Members area' };
  const opts = (list, sel) => list.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const fmtDate = d => { const t = Date.parse(d + 'T12:00:00'); return isNaN(t) ? d : new Date(t).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }); };

  function mount(el, o) {
    const reg = (o.registry && o.registry.resources) || [], store = o.store, uid = 'cr' + Math.random().toString(36).slice(2, 7);
    const prefs = store.get('cr_prefs') || {};
    const d = C.resolveDefault(store, o.billingRole);
    const S = { pt: d.provider_type, sp: d.specialty, tab: 'mine', q: '', purpose: '', category: '', freeOnly: false, showSub: prefs.show_subscription !== false, asked: false, prompt: false };
    el.classList.add('crp', 'crp-' + (o.layout || 'page'));
    el.innerHTML = `
      <div class="crp-head">
        <h2 class="crp-title" id="${uid}-t">Clinical resources</h2>
        <div class="crp-switch" role="group" aria-label="Provider type and specialty">
          <label><span>Provider type</span><select class="crp-pt" aria-label="Provider type">${opts(C.PROVIDER_TYPES, S.pt)}</select></label>
          <label class="crp-splab"><span>Specialty</span><select class="crp-sp" aria-label="Specialty">${opts(C.SPECIALTIES, S.sp)}</select></label>
        </div>
        <div class="crp-prompt" role="status" hidden><span>Make this my default?</span> <button type="button" class="crp-yes">Yes</button> <button type="button" class="crp-no">Not now</button></div>
        <div class="crp-tabs" role="tablist" aria-label="Sections">
          <button type="button" role="tab" data-t="mine">My view</button>
          <button type="button" role="tab" data-t="pharmacy">💊 Pharmacy</button>
          <button type="button" role="tab" data-t="id">🦠 Infectious diseases</button>
          <button type="button" role="tab" data-t="all">All</button>
        </div>
        <div class="crp-search"><input type="search" class="crp-q" placeholder="Search resources (e.g. PubMed, interactions, PPH)" aria-label="Search clinical resources" enterkeyhint="search" autocomplete="off" spellcheck="false"></div>
        <div class="crp-chips" role="group" aria-label="Filters">
          <button type="button" class="crp-chip" data-p="" aria-pressed="true">Any purpose</button>${C.PURPOSES.map(([k, l]) => `<button type="button" class="crp-chip" data-p="${k}" aria-pressed="false">${esc(l)}</button>`).join('')}
          <select class="crp-cat" aria-label="Category"><option value="">All categories</option>${Object.entries(C.CATEGORIES).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
          <label class="crp-chk"><input type="checkbox" class="crp-free"> Free only</label>
          <label class="crp-chk"><input type="checkbox" class="crp-sub"${S.showSub ? ' checked' : ''}> Show subscription</label>
        </div>
      </div>
      <div class="crp-body" aria-live="polite"></div>
      <p class="crp-foot">${DISCLAIMER} Search stays on this device.</p>`;
    const $ = s => el.querySelector(s);
    const ptSel = $('.crp-pt'), spSel = $('.crp-sp');
    const syncSp = () => { const ph = ['all', 'physician', 'np', 'midwife'].includes(S.pt); $('.crp-splab').hidden = !ph; };
    function card(r, favs) {
      const on = favs.includes(r.id), acc = ACCESS[r.access];
      const caveat = r.category === 'drug-interaction-checker' ? '<p class="crp-caveat">Decision support only; confirm with pharmacist/monograph.</p>' : '';
      return `<li class="crp-card">
        <div class="crp-row"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="crp-link">${esc(r.name)}<span class="crp-ext" aria-hidden="true"> ↗</span><span class="crp-sr"> (opens in a new tab)</span></a>
        <button type="button" class="crp-star" data-id="${esc(r.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Add to'} my resources: ${esc(r.name)}">${on ? '★' : '☆'}</button></div>
        ${r.description ? `<p class="crp-desc">${esc(r.description)}</p>` : ''}${caveat}
        <p class="crp-meta"><span class="crp-badge">${esc(C.CATEGORIES[r.category] || r.category)}</span><span class="crp-badge">${esc(r.region)}</span>${acc ? `<span class="crp-badge crp-${r.access}">${acc}</span>` : '<span class="crp-badge crp-free">Free</span>'}<span class="crp-ver">Last verified ${fmtDate(r.last_checked)}</span></p>
      </li>`;
    }
    function render() {
      syncSp();
      el.querySelectorAll('.crp-tabs [data-t]').forEach(b => { const on = b.dataset.t === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      el.querySelectorAll('.crp-chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === S.purpose));
      $('.crp-prompt').hidden = !S.prompt;
      const favs = C.favourites(store, reg);
      const f = { tab: S.q && S.tab === 'mine' ? 'all' : S.tab, provider_type: S.pt, specialty: S.sp, purpose: S.purpose, category: S.category, freeOnly: S.freeOnly, showSubscription: S.showSub };
      const list = C.search(reg, S.q, f, { favourites: favs, specialty: S.sp });
      const favList = list.filter(r => favs.includes(r.id)), rest = list.filter(r => !favs.includes(r.id));
      const heldFav = S.q ? [] : reg.filter(r => favs.includes(r.id) && !C.visible(r));
      let h = '';
      if (favList.length || heldFav.length) h += `<h3 class="crp-sec">★ My resources</h3><ul class="crp-list">${favList.map(r => card(r, favs)).join('')}${heldFav.map(r => `<li class="crp-card crp-off"><span>${esc(r.name)}</span><p class="crp-desc">Temporarily unavailable while the link is re-checked.</p></li>`).join('')}</ul>`;
      if (S.q || S.tab === 'all') h += rest.length ? `<ul class="crp-list">${rest.map(r => card(r, favs)).join('')}</ul>` : '';
      else {
        const groups = {}; rest.forEach(r => (groups[r.category] = groups[r.category] || []).push(r));
        h += Object.keys(C.CATEGORIES).filter(k => groups[k]).map(k => `<h3 class="crp-sec">${esc(C.CATEGORIES[k])}</h3><ul class="crp-list">${groups[k].map(r => card(r, favs)).join('')}</ul>`).join('');
      }
      if (!list.length) h += `<p class="crp-empty">No resources match. Try another word, or the All tab.</p>`;
      $('.crp-body').innerHTML = h;
    }
    function viewChanged() {
      S.pt = ptSel.value; S.sp = spSel.value;
      const d0 = store.get('cr_default');
      S.prompt = !S.asked && !(d0 && d0.provider_type === S.pt && d0.specialty === S.sp);
      render();
    }
    ptSel.addEventListener('change', viewChanged); spSel.addEventListener('change', viewChanged);
    $('.crp-yes').addEventListener('click', () => { store.set('cr_default', { provider_type: S.pt, specialty: S.sp }); S.prompt = false; S.asked = true; render(); });
    $('.crp-no').addEventListener('click', () => { S.prompt = false; S.asked = true; render(); });
    $('.crp-tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { S.tab = b.dataset.t; render(); } });
    $('.crp-tabs').addEventListener('keydown', e => { if (!/Arrow(Left|Right)/.test(e.key)) return; const bs = [...el.querySelectorAll('.crp-tabs [data-t]')], i = bs.findIndex(b => b.dataset.t === S.tab), n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; S.tab = n.dataset.t; render(); n.focus(); });
    $('.crp-q').addEventListener('input', e => { S.q = e.target.value; render(); });
    $('.crp-chips').addEventListener('click', e => { const b = e.target.closest('.crp-chip'); if (b) { S.purpose = b.dataset.p; render(); } });
    $('.crp-cat').addEventListener('change', e => { S.category = e.target.value; render(); });
    $('.crp-free').addEventListener('change', e => { S.freeOnly = e.target.checked; render(); });
    $('.crp-sub').addEventListener('change', e => { S.showSub = e.target.checked; const p = store.get('cr_prefs') || {}; p.show_subscription = S.showSub; store.set('cr_prefs', p); render(); });
    $('.crp-body').addEventListener('click', e => { const b = e.target.closest('.crp-star'); if (!b) return; const r = C.toggleFavourite(store, b.dataset.id); if (!r.ok) alert('You can keep up to ' + C.FAV_CAP + ' favourites.'); render(); const nb = el.querySelector(`.crp-star[data-id="${b.dataset.id}"]`); if (nb) nb.focus(); });
    const unsub = store.subscribe(k => { if (k === 'cr_default' && !S.prompt) { const d1 = C.resolveDefault(store, o.billingRole); S.pt = d1.provider_type; S.sp = d1.specialty; ptSel.value = S.pt; spSel.value = S.sp; render(); } });
    render();
    return { el, state: S, render, destroy() { unsub(); el.innerHTML = ''; } };
  }
  root.CRPanel = { mount, DISCLAIMER };
})(typeof self !== 'undefined' ? self : this);
