#!/usr/bin/env python3
"""Build public/data/fees-AB.json (v9t entry window: fee estimates and rule checks) from MedBilling Fee Desk's bundled
Alberta SOMB data (/workspace/feedesk/public/data/codes.json; Alberta Health, Schedule of Medical Benefits,
Open Government Licence - Alberta). Per code: base, skill fees, modifier actions, and flags:
  f = obstetric / female genital code (usually female patient only), m = male genital code,
  r = usually needs a referring provider (consultations, interpretations, notes that mention a referral),
  t = time-premium code that needs a time modifier (SURT)."""
import json, re, os, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/feedesk/public/data/codes.json'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'fees-AB.json')
d = json.load(open(SRC))
meta = json.load(open(os.path.join(os.path.dirname(SRC), 'meta.json'))) if os.path.exists(os.path.join(os.path.dirname(SRC), 'meta.json')) else {}
out = {}
for c in d:
    fl = ''
    sec, desc, notes = c.get('section', ''), c.get('desc', ''), c.get('notes') or ''
    if re.search(r'Obstetric|Female Genital', sec) or re.search(r'prenatal|antenatal|postpartum|postnatal|obstetric|pregnan|labour|delivery', desc, re.I): fl += 'f'
    if re.search(r'Male Genital', sec) and 'f' not in fl: fl += 'm'
    if re.search(r'consultation', desc, re.I) or re.match(r'Interpretation', desc) or re.search(r'referr', notes, re.I): fl += 'r'
    mods = []
    for r in c.get('mods') or []:
        typ, code, expl, act, val, tiers = (list(r) + [None] * 6)[:6]
        if typ == 'SURT' and 't' not in fl: fl += 't'
        mods.append([code, act or '', val or '', [[t[0], t[1], t[2]] for t in tiers] if tiers else 0, 1 if expl else 0, typ])
    out[c['code']] = [c.get('base'), c.get('skill') or 0, mods, fl]
res = {'v': 1, 'meta': {'source': 'Alberta Health, Schedule of Medical Benefits (via MedBilling Fee Desk bundled data)', 'licence': 'Open Government Licence - Alberta', 'note': 'Estimates only: base rate, skill fee and listed modifier actions; Alberta Health assessment decides the payment.', 'feeDesk': meta.get('effective') or meta.get('version') or ''}, 'c': out}
json.dump(res, open(OUT, 'w'), separators=(',', ':'))
print(OUT, os.path.getsize(OUT), 'bytes', len(out), 'codes')
