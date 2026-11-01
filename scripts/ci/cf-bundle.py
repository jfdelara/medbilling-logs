#!/usr/bin/env python3
"""Build the Cloudflare Pages copy of Logs: public/ -> dist-cf/ with the service-worker redirect fix.

Pages answers /x.html with a 308 to /x, and a redirected Response cannot be served to a navigation, so the CF copy of
sw.js re-wraps redirected responses in (1) the install step and (2) the navigate fetch handler. The repo sw.js (also
used by GitHub Pages) is left unchanged. Fails loudly if a line to patch is not found exactly once.

Usage: python3 scripts/ci/cf-bundle.py [--src public] [--out dist-cf]"""
import argparse, os, shutil

INSTALL_OLD = "fetch(new Request(a, { cache: 'reload' })).then(r => { if (r.ok) return c.put(a, r); })"
INSTALL_NEW = ("fetch(new Request(a, { cache: 'reload' })).then(async r => { if (r.ok) return c.put(a, "
               "r.redirected ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r); })")
NAV_OLD = "{ cache: 'no-cache' }).then(res => {\n"
NAV_NEW = ("{ cache: 'no-cache' }).then(async res => {\n"
           "    // [Cloudflare Pages copy] Pages 308s /index.html to /; a redirected response cannot satisfy a navigation, so re-wrap it.\n"
           "    if (res.redirected) res = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });\n")
BANNER = "/* [Cloudflare Pages copy] Redirect handling added (see fetch/install). */\n"

def patch_sw(text):
    for old in (INSTALL_OLD, NAV_OLD):
        if text.count(old) != 1: raise SystemExit("cf-bundle: a sw.js line to patch was not found exactly once; update scripts/ci/cf-bundle.py")
    return BANNER + text.replace(INSTALL_OLD, INSTALL_NEW).replace(NAV_OLD, NAV_NEW)

def build(src, out):
    if os.path.exists(out): shutil.rmtree(out)
    shutil.copytree(src, out, ignore=shutil.ignore_patterns('.nojekyll', '.DS_Store'))
    p = os.path.join(out, 'sw.js')
    patched = patch_sw(open(p, encoding='utf-8').read())
    open(p, 'w', encoding='utf-8').write(patched)
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--src', default='public'); ap.add_argument('--out', default='dist-cf')
    a = ap.parse_args(); print('cf-bundle:', build(a.src, a.out))
