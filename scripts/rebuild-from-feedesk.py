#!/usr/bin/env python3
"""Regenerate MedBilling Logs' bundled data from a Fee Desk checkout, bump the service-worker cache and mirror public/ to site/.

    python3 scripts/rebuild-from-feedesk.py --feedesk ../feedesk [--date YYYYMMDD] [--result out.json] [--no-bump]

Used by .github/workflows/feedesk-data-rebuild.yml (triggered by Fee Desk's Monday data update) and runnable by hand.
Steps: (1) find Fee Desk's data folder (site/data, else public/data); (2) run build-codes.py, build-fees.py, build-icd9.py;
(3) list the public/data files whose content changed; (4) if any changed: bump `const V` in public/sw.js (the `url-switch` token stays,
tests/suite-parity.test.js needs it) and mirror public/ into site/ (the Pages workflow publishes site/; the two must stay identical).
If nothing changed it stops with changed=false and touches nothing else. It never writes into the Fee Desk checkout.
Held jurisdictions (BC, ON, QC, PE, NB, NS) stay refused by build-codes.py."""
import argparse, datetime, hashlib, json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB, SITE = os.path.join(ROOT, 'public'), os.path.join(ROOT, 'site')
SW = os.path.join(PUB, 'sw.js')
V_RE = re.compile(r"^(const V = ')(bl-v13-)(\d{8})(-[A-Za-z0-9._-]*?)(-data\d+)?(';)", re.M)

def die(msg): sys.exit('rebuild-from-feedesk: ' + msg)

def fd_data_dir(fd):
    for sub in ('site/data', 'public/data'):
        d = os.path.join(fd, sub)
        if os.path.isfile(os.path.join(d, 'codes.json')):
            for need in ('meta.json', 'icd9.json', os.path.join('prov', 'index.json')):
                if not os.path.isfile(os.path.join(d, need)): die(f'{d} is missing {need}')
            return d
    die(f'no Fee Desk data folder (site/data or public/data with codes.json) under {fd}')

def snapshot(folder):
    out = {}
    for dp, _, fs in os.walk(folder):
        for n in fs:
            p = os.path.join(dp, n)
            out[os.path.relpath(p, folder)] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    return out

def bump_sw(date, sw_path=SW):
    """bl-v13-<date>-<tag>[-dataN] -> bl-v13-<today>-<tag>-data<N+1> (N+1 resets to 1 on a new date)."""
    s = open(sw_path, encoding='utf-8').read()
    m = V_RE.search(s)
    if not m: die(f'`const V = \'bl-v13-YYYYMMDD-...\'` not found in {sw_path}')
    prev_date, tag, n = m.group(3), m.group(4), int(m.group(5)[5:]) if m.group(5) else 0
    nxt = n + 1 if prev_date == date else 1
    new = f'bl-v13-{date}{tag}-data{nxt}'
    if 'url-switch' not in new: die('the new cache name lost the url-switch token (tests/suite-parity.test.js needs it)')
    s = s[:m.start()] + m.group(1) + new + m.group(6) + s[m.end():]
    open(sw_path, 'w', encoding='utf-8').write(s)
    return m.group(2) + prev_date + tag + (m.group(5) or ''), new

def mirror(src=PUB, dst=SITE):
    """Make dst identical to src (keeps dst/.nojekyll if it exists)."""
    keep = {'.nojekyll'}
    for dp, dn, fs in os.walk(dst, topdown=False):
        for n in fs:
            p = os.path.join(dp, n); rel = os.path.relpath(p, dst)
            if rel not in keep and not os.path.exists(os.path.join(src, rel)): os.remove(p)
        for d in dn:
            p = os.path.join(dp, d)
            if os.path.isdir(p) and not os.listdir(p): os.rmdir(p)
    for dp, _, fs in os.walk(src):
        for n in fs:
            s = os.path.join(dp, n); d = os.path.join(dst, os.path.relpath(s, src))
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if not os.path.exists(d) or open(s, 'rb').read() != open(d, 'rb').read(): shutil.copyfile(s, d)

def identical(a=PUB, b=SITE):
    sa, sb = snapshot(a), snapshot(b); sb.pop('.nojekyll', None)
    return sorted(set(sa) ^ set(sb)) + sorted(k for k in sa if k in sb and sa[k] != sb[k])

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--feedesk', required=True, help='path to a Fee Desk checkout')
    ap.add_argument('--date', default=datetime.date.today().strftime('%Y%m%d'))
    ap.add_argument('--result', help='write a JSON summary here')
    ap.add_argument('--no-bump', action='store_true')
    a = ap.parse_args(argv)
    if not re.fullmatch(r'\d{8}', a.date): die('--date must be YYYYMMDD')
    data = fd_data_dir(os.path.abspath(a.feedesk))
    before = snapshot(os.path.join(PUB, 'data'))
    for cmd in ([sys.executable, 'scripts/build-codes.py', data], [sys.executable, 'scripts/build-fees.py', os.path.join(data, 'codes.json')],
                [sys.executable, 'scripts/build-icd9.py', data]):
        r = subprocess.run(cmd, cwd=ROOT)
        if r.returncode: die(f'{os.path.basename(cmd[1])} failed (exit {r.returncode}); nothing was bumped or mirrored')
    after = snapshot(os.path.join(PUB, 'data'))
    changed = sorted(k for k in after if before.get(k) != after[k]) + sorted(k for k in before if k not in after)
    res = {'changed': bool(changed), 'files': changed, 'feedesk_data': data, 'sw_before': None, 'sw_after': None}
    if changed and not a.no_bump:
        res['sw_before'], res['sw_after'] = bump_sw(a.date)
        mirror()
        diff = identical()
        if diff: die('public/ and site/ differ after mirroring: ' + ', '.join(diff))
    print(json.dumps(res, indent=1))
    if a.result: json.dump(res, open(a.result, 'w'), indent=1)
    return 0

if __name__ == '__main__':
    sys.exit(main())
