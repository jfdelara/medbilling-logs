/* MedBilling Logs b11 - patient scan (camera → Name, Sex, ULI). Everything runs on the device: the native iOS plugin
   (MBScan, VisionKit DataScanner: on-device text + barcode recognition) when present, else the browser's own
   BarcodeDetector / TextDetector on a photo taken with the camera, else typing. No network call is made here, the photo is
   never saved (only an object URL in memory, revoked when the sheet closes) and nothing is written until the user confirms
   the values in the entry window. Use test cards / labels only while this is being tried. */
(function (global) {
  'use strict';
  // ---- pure parser: OCR text and barcode payloads → { name, sex, uli, found[] }
  const SEXW = { F: 'F', FEMALE: 'F', M: 'M', MALE: 'M', X: 'X', U: 'U', UNKNOWN: 'U' };
  function parse(texts) {
    const all = (Array.isArray(texts) ? texts : [texts]).filter(Boolean).map(String).join('\n');
    const lines = all.split(/[\r\n|^;]+/).map(s => s.trim()).filter(Boolean), out = { name: '', sex: '', uli: '', found: [] };
    // ULI / PHN: 9 digits (Alberta prints 12345-6789); labelled ones win, never a date or a longer number
    const lab = all.match(/\b(?:ULI|PHN|AHC|HEALTH\s*(?:CARD|NO|#)|PERSONAL\s*HEALTH\s*(?:NUMBER|NO))\s*[#:.]?\s*(\d{5}[-\s]?\d{4})(?!\d)/i);
    const any = lab || all.match(/(?<![\d-])(\d{5}[-\s]?\d{4})(?![\d-])/);
    if (any) { out.uli = any[1].replace(/\D/g, ''); out.found.push(lab ? 'ULI (labelled)' : 'ULI (9 digits)'); }
    // sex: "SEX: F", "SEX F", "F/45", "Gender: Male"
    let m = all.match(/\b(?:SEX|GENDER)\s*[:=]?\s*(FEMALE|MALE|UNKNOWN|[FMXU])\b/i) || all.match(/\b([FM])\s*\/\s*\d{1,3}\s*(?:Y|YR|YRS)?\b/);
    if (m) { out.sex = SEXW[m[1].toUpperCase()] || ''; if (out.sex) out.found.push('Sex'); }
    // name: "NAME: LAST, FIRST", or a "LAST, FIRST" line, or "LAST^FIRST" (HL7-style labels)
    const STOP = /^(AB|ULI|MRN|PHN|PI|PT|MR|HC|CA|AHS)$/i;
    m = all.match(/\b(?:NAME|PATIENT|PT)\s*[:=]\s*([A-Za-zÀ-ÿ' .-]+,\s*[A-Za-zÀ-ÿ' .-]+)/i) || [...all.matchAll(/([A-Za-zÀ-ÿ'-]{2,})\^([A-Za-zÀ-ÿ'-]{2,})/g)].find(x => !STOP.test(x[1]) && !STOP.test(x[2]));
    if (m) out.name = m[2] && !m[1].includes(',') ? `${m[1]}, ${m[2]}` : m[1];
    else { const l = lines.find(s => /^[A-Za-zÀ-ÿ'-]{2,}(?:\s[A-Za-zÀ-ÿ'-]+)*,\s*[A-Za-zÀ-ÿ'-]{2,}(?:\s[A-Za-zÀ-ÿ'.-]+)*$/.test(s) && !/\b(ALBERTA|HEALTH|HOSPITAL|CARE|CANADA|SERVICES)\b/i.test(s)); if (l) out.name = l; }
    if (out.name) { out.name = tidy(out.name); out.found.push('Name'); }
    return out;
  }
  const cap = w => w.toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, (a, b, c) => b + c.toUpperCase());
  function tidy(n) { const s = n.replace(/\s+/g, ' ').trim().replace(/\s*,\s*/, ', '); return s === s.toUpperCase() ? cap(s) : s; }

  // ---- capture: native plugin → browser detectors on a photo → nothing (type it)
  const plug = () => { const C = global.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.MBScan || null; };
  async function fromPhoto(file) {
    const texts = [], bmp = await createImageBitmap(file);
    try {
      if ('BarcodeDetector' in global) { try { const d = new global.BarcodeDetector(); (await d.detect(bmp)).forEach(b => texts.push(b.rawValue)); } catch (e) { /* not supported here */ } }
      if ('TextDetector' in global) { try { const d = new global.TextDetector(); (await d.detect(bmp)).forEach(b => texts.push(b.rawValue)); } catch (e) { /* not supported here */ } }
    } finally { if (bmp.close) bmp.close(); }
    return texts;
  }
  const canPhotoDetect = () => 'BarcodeDetector' in global || 'TextDetector' in global;

  // ---- the confirm sheet
  let dlg = null, done = null, url = '';
  const $ = s => dlg.querySelector(s);
  function build() {
    dlg = document.createElement('dialog'); dlg.id = 'scanDlg'; dlg.className = 'ptdlg scandlg'; dlg.setAttribute('aria-labelledby', 'scanT');
    dlg.innerHTML = `<div class="pthead"><b id="scanT">Scan patient</b><button type="button" class="ghost sm" data-x aria-label="Close">✕</button></div>
      <p class="small muted">Health card, hospital label or wristband. Read on this device only: no photo is kept and nothing is sent.</p>
      <div class="scanbtns"><button type="button" class="primary" data-cam>📷 Scan with camera</button><input type="file" accept="image/*" capture="environment" hidden data-file></div>
      <p class="small" data-st aria-live="polite"></p><img alt="" data-img hidden class="scanimg">
      <label class="fldl" for="scan_n">Patient name</label><input id="scan_n" autocomplete="off" autocorrect="off" spellcheck="false">
      <label class="fldl" for="scan_s">Sex</label><select id="scan_s"><option value="">–</option><option value="M">M · Male</option><option value="F">F · Female</option><option value="X">X</option><option value="U">U · Unknown</option></select>
      <label class="fldl" for="scan_u">ULI / PHN</label><input id="scan_u" class="mono" inputmode="numeric" maxlength="11" autocomplete="off">
      <p class="small muted">Check every value against the card before you use it.</p>
      <div class="scanact"><button type="button" class="ghost" data-x>Cancel</button><button type="button" class="primary" data-ok>Use these</button></div>`;
    document.body.appendChild(dlg);
    dlg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close());
    dlg.addEventListener('close', clearImg);
    $('[data-ok]').onclick = () => { const v = { name: $('#scan_n').value.trim(), sex: $('#scan_s').value, uli: $('#scan_u').value.replace(/\D/g, '') }; const f = done; close(); if (f) f(v); };
    $('[data-cam]').onclick = async () => {
      const p = plug();
      if (p) { st('Opening the camera…'); try { const r = await p.scan(); apply(parse([].concat(r && r.barcodes || [], r && r.text || []))); } catch (e) { st('Scan cancelled or not available. You can type the values.'); } return; }
      $('[data-file]').click();
    };
    $('[data-file]').onchange = async ev => {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
      clearImg(); url = URL.createObjectURL(f); const im = $('[data-img]'); im.src = url; im.hidden = false;
      if (!canPhotoDetect()) return st('This device cannot read text from the photo here yet. Type the values from the photo.');
      st('Reading…'); try { apply(parse(await fromPhoto(f))); } catch (e) { st('Could not read the photo. Type the values.'); }
    };
  }
  function st(t) { $('[data-st]').textContent = t; }
  function clearImg() { if (url) { URL.revokeObjectURL(url); url = ''; } if (dlg) { const im = $('[data-img]'); im.removeAttribute('src'); im.hidden = true; } }
  function apply(r) {
    if (r.name) $('#scan_n').value = r.name; if (r.sex) $('#scan_s').value = r.sex; if (r.uli) $('#scan_u').value = r.uli;
    st(r.found.length ? `Found: ${r.found.join(', ')}. Please check.` : 'Nothing readable found. Try again closer, or type the values.');
  }
  function close() { done = null; if (dlg && dlg.open) dlg.close(); clearImg(); }
  function open(pre, cb) {
    if (!dlg) build(); done = cb; pre = pre || {};
    $('#scan_n').value = pre.name || ''; $('#scan_s').value = pre.sex || ''; $('#scan_u').value = pre.uli || ''; st('');
    if (!dlg.open) dlg.showModal();
  }
  global.MBScan = { parse, open, close, native: () => !!plug() };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = (typeof window !== 'undefined' ? window : globalThis).MBScan;
