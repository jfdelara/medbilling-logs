/* Clinical Resources core (Phase 1, Option A). Pure logic: no DOM, no network.
   Search runs on this device only; queries are never sent anywhere or logged. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.CRCore = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PROVIDER_TYPES = [['physician', 'Physician'], ['np', 'Nurse practitioner'], ['midwife', 'Midwife'], ['dentistry', 'Dentistry'], ['dental-hygiene', 'Dental hygiene'], ['chiropractic', 'Chiropractic'], ['physiotherapy', 'Physiotherapy'], ['optometry', 'Optometry'], ['podiatry', 'Podiatry'], ['ot', 'Occupational therapy'], ['pharmacy', 'Pharmacy'], ['dietetics', 'Dietetics'], ['all', 'All provider types']];
  const SPECIALTIES = [['obgyn', 'OB/GYN'], ['family-medicine', 'Family medicine'], ['all', 'All specialties']];
  const CATEGORIES = { 'journal': 'Journals', 'research-database': 'Research databases', 'book': 'Books / textbooks', 'guidelines-society': 'Guidelines & societies', 'point-of-care': 'Point of care', 'patient-counselling': 'Patient brochures & counselling', 'drug-monograph': 'Drug monographs', 'drug-database': 'Drug references', 'drug-interaction-checker': 'Interaction checkers', 'manufacturer-directory': 'Manufacturer directories', 'antimicrobial-guidance': 'Antimicrobial guidance', 'public-health': 'Public health', 'regulator': 'Regulators', 'association': 'Associations' };
  const PURPOSES = [['diagnosis', 'Dx'], ['etiology', 'Etiology'], ['pathophysiology', 'Patho'], ['classification', 'Classification'], ['symptoms', 'Symptoms'], ['investigations', 'Ix'], ['treatment', 'Tx'], ['prognosis', 'Prognosis'], ['counselling', 'Counselling']];
  const PROVINCES = ['AB', 'BC', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'];
  const REGION_ORDER = { AB: 0, CA: 1, US: 2, UK: 2, INTL: 3 };
  const FAV_CAP = 50;
  const SYN = { pph: 'postpartum haemorrhage obstetric sogc acog', gdm: 'gestational diabetes pregnancy obstetric', uti: 'urinary infection antimicrobial bugs', 'drug interactions': 'interaction checker', interactions: 'interaction checker drug', antibiotic: 'antimicrobial bugs drugs', antibiotics: 'antimicrobial bugs drugs', vaccine: 'immunization public health', monograph: 'drug monograph product dpd', prenatal: 'pregnancy obstetric', screening: 'preventive task force', guidelines: 'guidelines society', textbook: 'book books', dental: 'dentistry dental', chiro: 'chiropractic', physio: 'physiotherapy', nutrition: 'dietetics dietitians food', feet: 'podiatry', eye: 'optometry', ot: 'occupational therapy' };
  const label = (list, k) => (list.find(x => x[0] === k) || [k, k])[1];
  const visible = r => r.status === 'ok';
  const isCross = r => (r.cross_specialty || []).length > 0;

  function matchesView(r, view) {
    const pt = view.provider_type || 'all', sp = view.specialty || 'all';
    if (pt !== 'all' && !(r.provider_types.includes(pt) || r.provider_types.includes('all'))) return false;
    const usesSpecialty = pt === 'all' || pt === 'physician' || pt === 'np' || pt === 'midwife';
    if (usesSpecialty && sp !== 'all' && (r.specialties || []).length && !r.specialties.includes(sp)) return false;
    if (usesSpecialty && sp !== 'all' && !(r.specialties || []).length && !r.provider_types.some(t => t === pt) && pt !== 'all') return false;
    return true;
  }
  // tab: mine | pharmacy | id | all
  function filter(resources, f) {
    f = f || {};
    return resources.filter(r => {
      if (!visible(r)) return false;
      if (f.tab === 'pharmacy' && !(r.cross_specialty || []).includes('pharmacy')) return false;
      if (f.tab === 'id' && !(r.cross_specialty || []).includes('infectious-diseases')) return false;
      if (f.tab === 'mine' && (isCross(r) || !matchesView(r, f))) return false;
      if (f.category && r.category !== f.category) return false;
      if (f.purpose && !(r.purposes || []).includes(f.purpose)) return false;
      if (f.freeOnly && r.access !== 'free') return false;
      if (f.showSubscription === false && r.access === 'subscription') return false;
      if (f.language && f.language !== 'en' && !(r.languages || ['en']).includes(f.language)) return false;
      return true;
    });
  }
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9/&.+ -]/g, ' ');
  function hay(r) {
    return norm([r.name, r.description, CATEGORIES[r.category], r.category, (r.provider_types || []).map(p => label(PROVIDER_TYPES, p) + ' ' + p).join(' '), (r.specialties || []).map(s => label(SPECIALTIES, s)).join(' '), (r.purposes || []).join(' '), (r.cross_specialty || []).join(' '), r.url.replace(/^https:\/\/(www\.)?/, '')].join(' '));
  }
  function textScore(r, q) {
    q = norm(q).trim(); if (!q) return 1;
    let terms = q.split(/\s+/); const exp = [SYN[q]].concat(terms.map(t => SYN[t])).filter(Boolean).join(' ');
    const h = hay(r), n = norm(r.name);
    let s = 0;
    if (n.includes(q)) s += 10;
    for (const t of terms) { if (n.split(/\s+/).some(w => w.startsWith(t))) s += 4; else if (h.includes(t)) s += 2; else if (t.length > 3 && fuzzy(h, t)) s += 1; }
    if (exp) for (const t of exp.split(/\s+/)) if (h.includes(t)) s += 1;
    return s;
  }
  function fuzzy(h, t) { // one edit tolerance on any word
    return h.split(/\s+/).some(w => { if (Math.abs(w.length - t.length) > 1) return false; let i = 0, j = 0, e = 0; while (i < w.length && j < t.length) { if (w[i] === t[j]) { i++; j++; } else { if (++e > 1) return false; if (w.length > t.length) i++; else if (t.length > w.length) j++; else { i++; j++; } } } return e + (w.length - i) + (t.length - j) <= 1; });
  }
  // favourites first, then default specialty, then AB, CA, INTL, then name (spec §6). With a query, relevance leads.
  function rank(list, ctx) {
    ctx = ctx || {}; const fav = new Set(ctx.favourites || []), q = ctx.query || '';
    return list.map(r => ({ r, s: textScore(r, q) })).filter(x => !q || x.s > 0).sort((a, b) =>
      (q ? b.s - a.s : 0) || (fav.has(b.r.id) - fav.has(a.r.id)) ||
      ((ctx.specialty && (b.r.specialties || []).includes(ctx.specialty)) - (ctx.specialty && (a.r.specialties || []).includes(ctx.specialty))) ||
      ((REGION_ORDER[a.r.region] ?? 9) - (REGION_ORDER[b.r.region] ?? 9)) || a.r.name.localeCompare(b.r.name)).map(x => x.r);
  }
  function search(resources, q, f, ctx) { return rank(filter(resources, f), Object.assign({}, ctx, { query: q })); }

  // ---- ProfileStore (get/set/subscribe). Phase 1: LocalAppSettingsStore; Phase B adds SharedAccountProfileStore.
  function LocalAppSettingsStore(prefix, storage) {
    const st = storage || (typeof localStorage !== 'undefined' ? localStorage : memoryStorage()), subs = new Set(), P = (prefix || 'cr') + '.';
    return {
      get(k) { try { const v = st.getItem(P + k); return v == null ? null : JSON.parse(v); } catch { return null; } },
      set(k, v) { if (v == null) st.removeItem(P + k); else st.setItem(P + k, JSON.stringify(v)); subs.forEach(fn => { try { fn(k, v); } catch (e) { } }); },
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
    };
  }
  function memoryStorage() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }

  const PROFILE_VERSION = 1;
  function makeProfile(a, sourceApp, now) {
    return { version: PROFILE_VERSION, provider_type: a.provider_type || 'all', specialty: a.specialty || 'all', province: a.province || 'AB', categories: (a.categories || []).slice(), code_prefs: a.code_prefs || { code_set: (a.province || 'AB'), favourite_codes: [] }, language: a.language === 'fr' ? 'fr' : 'en', show_subscription: a.show_subscription !== false, updated_at: new Date(now || Date.now()).toISOString(), source_app: sourceApp || 'unknown' };
  }
  function validProfile(p) { return !!p && p.version === PROFILE_VERSION && typeof p.provider_type === 'string' && typeof p.updated_at === 'string'; }
  // Default view (spec §8): remembered cr_default → onboarding answers → billing role → All.
  function resolveDefault(store, billingRole) {
    const d = store.get('cr_default'); if (d && d.provider_type) return { provider_type: d.provider_type, specialty: d.specialty || 'all', source: 'remembered' };
    const p = store.get('onboarding_profile'); if (validProfile(p)) return { provider_type: p.provider_type, specialty: p.specialty || 'all', source: 'onboarding' };
    if (billingRole && billingRole.provider_type) return { provider_type: billingRole.provider_type, specialty: billingRole.specialty || 'all', source: 'billing' };
    return { provider_type: 'all', specialty: 'all', source: 'none' };
  }
  function applyProfile(store, p) {
    store.set('onboarding_profile', p);
    store.set('cr_default', { provider_type: p.provider_type, specialty: p.specialty });
    store.set('cr_prefs', { categories: p.categories, show_subscription: p.show_subscription, language: p.language, province: p.province });
    store.set('cr_onboard_state', { done_at: p.updated_at });
  }
  // First-run state: 'show' | 'banner' (skipped ≥7 days ago, once) | 'none'
  function onboardingState(store, now) {
    if (validProfile(store.get('onboarding_profile'))) return 'none';
    const s = store.get('cr_onboard_state') || {};
    if (s.skipped_at) return (!s.reprompted && (now || Date.now()) - Date.parse(s.skipped_at) >= 7 * 864e5) ? 'banner' : 'none';
    return 'show';
  }
  function skipOnboarding(store, now) { store.set('cr_onboard_state', { skipped_at: new Date(now || Date.now()).toISOString() }); }
  function markReprompted(store) { const s = store.get('cr_onboard_state') || {}; s.reprompted = true; store.set('cr_onboard_state', s); }

  function favourites(store, registry) {
    const ids = new Set(registry.map(r => r.id));
    const f = (store.get('cr_favourites') || []).filter(id => ids.has(id)); // removed IDs dropped silently
    return f;
  }
  function toggleFavourite(store, id) {
    const f = store.get('cr_favourites') || []; const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else { if (f.length >= FAV_CAP) return { ok: false, reason: 'cap', list: f }; f.push(id); }
    store.set('cr_favourites', f); return { ok: true, list: f, on: i < 0 };
  }
  // Migration dry-run helper for Option 2 (with B): newest profile wins.
  function mergeProfiles(list) {
    const v = list.filter(validProfile).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    if (!v.length) return { profile: null, merged: false };
    const differs = v.some(p => JSON.stringify(Object.assign({}, p, { updated_at: 0, source_app: 0 })) !== JSON.stringify(Object.assign({}, v[0], { updated_at: 0, source_app: 0 })));
    return { profile: v[0], merged: v.length > 1, notice: v.length > 1 && differs ? 'We merged your preferences' : null };
  }
  return { PROVIDER_TYPES, SPECIALTIES, CATEGORIES, PURPOSES, PROVINCES, FAV_CAP, label, visible, filter, rank, search, textScore, matchesView, LocalAppSettingsStore, memoryStorage, makeProfile, validProfile, resolveDefault, applyProfile, onboardingState, skipOnboarding, markReprompted, favourites, toggleFavourite, mergeProfiles };
});
