#!/usr/bin/env python3
"""Assemble the published MedBilling Logs site: landing + /export/ + /web/.

Copies site/ (Get-the-app page, privacy policy, legacy /export/, root service worker) and
places public/ at /web/. Cloudflare Pages 308s /web/index.html to /web/, so the CF copy of
web/sw.js re-wraps redirected responses. GitHub Pages uses the unpatched worker
(--no-sw-patch). Fails loudly if a line to patch is not found exactly once.

Usage:
  python3 scripts/ci/cf-bundle.py --src public --site site --out dist-cf
  python3 scripts/ci/cf-bundle.py --src public --site site --out dist-pages --no-sw-patch
"""
import argparse, os, shutil

INSTALL_OLD = "fetch(new Request(a, { cache: 'reload' })).then(r => { if (r.ok) return c.put(a, r); })"
INSTALL_NEW = ("fetch(new Request(a, { cache: 'reload' })).then(async r => { if (r.ok) return c.put(a, "
               "r.redirected ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r); })")
NAV_OLD = "{ cache: 'no-cache' }).then(res => {\n"
NAV_NEW = ("{ cache: 'no-cache' }).then(async res => {\n"
           "    // [Cloudflare Pages copy] Pages 308s /index.html to /; a redirected response cannot satisfy a navigation, so re-wrap it.\n"
           "    if (res.redirected) res = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });\n")
BANNER = "/* [Cloudflare Pages copy] Redirect handling added (see fetch/install). */\n"
IGNORE = shutil.ignore_patterns('.DS_Store', '.git')
WEB_CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; "
           "connect-src 'self'; form-action 'none'; manifest-src 'self'; worker-src 'self'; "
           "base-uri 'self'; object-src 'none'")
HEADERS = f"""# Cloudflare Pages headers. GitHub Pages ignores this file.
# App CSP stays on /web/ only — the landing page uses inline CSS.
/web/*
  Content-Security-Policy: {WEB_CSP}
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
"""

def patch_sw(text):
    for old in (INSTALL_OLD, NAV_OLD):
        if text.count(old) != 1: raise SystemExit("cf-bundle: a sw.js line to patch was not found exactly once; update scripts/ci/cf-bundle.py")
    return BANNER + text.replace(INSTALL_OLD, INSTALL_NEW).replace(NAV_OLD, NAV_NEW)

def _copy_tree(src, dst):
    if os.path.exists(dst): shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=IGNORE)

def build(src, out, site='site', patch=True):
    src, site, out = os.path.abspath(src), os.path.abspath(site), os.path.abspath(out)
    if not os.path.isfile(os.path.join(site, 'index.html')):
        raise SystemExit('cf-bundle: site/index.html missing (landing page)')
    if not os.path.isfile(os.path.join(src, 'index.html')):
        raise SystemExit('cf-bundle: app index.html missing under --src')
    if os.path.exists(out): shutil.rmtree(out)
    os.makedirs(out)
    for name in sorted(os.listdir(site)):
        if name in ('web', '.DS_Store'): continue
        s, d = os.path.join(site, name), os.path.join(out, name)
        if os.path.isdir(s): shutil.copytree(s, d, ignore=IGNORE)
        else: shutil.copy2(s, d)
    web = os.path.join(out, 'web')
    _copy_tree(src, web)
    open(os.path.join(out, '.nojekyll'), 'a').close()
    if patch:
        p = os.path.join(web, 'sw.js')
        patched = patch_sw(open(p, encoding='utf-8').read())
        open(p, 'w', encoding='utf-8').write(patched)
        open(os.path.join(out, '_headers'), 'w', encoding='utf-8').write(HEADERS)
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='public')
    ap.add_argument('--site', default='site')
    ap.add_argument('--out', default='dist-cf')
    ap.add_argument('--no-sw-patch', action='store_true', help='skip Cloudflare redirect patch (GitHub Pages)')
    a = ap.parse_args()
    print('cf-bundle:', build(a.src, a.out, site=a.site, patch=not a.no_sw_patch))
