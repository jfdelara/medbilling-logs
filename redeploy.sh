#!/usr/bin/env bash
# Stage the published site for GitHub Pages (the Logs repository).
# Assembles landing + /export/ + /web/ (from public/) then uploads a tarball.
# 1) python3 scripts/ci/cf-bundle.py (set BUMP_SW=1 to auto-bump public/sw.js first)
# 2) uploads a tarball to a temporary (3-day) shipstatic URL
# 3) prints the line to commit as .deploy/bundle.txt on main; the Actions
#    workflow then downloads it, verifies the sha256, writes it to site/ and publishes gh-pages.
# Do not run this against live Cloudflare Pages from a feature branch.
set -euo pipefail
cd "$(dirname "$0")"
[ "${BUMP_SW:-0}" = 1 ] && sed -i "s/^const V = '[^']*';/const V = 'bl-$(date +%Y%m%d%H%M%S)';/" public/sw.js
T=$(mktemp -d); mkdir -p "$T/stage"
python3 scripts/ci/cf-bundle.py --src public --site site --out "$T/site" --no-sw-patch
tar -C "$T/site" -czf "$T/stage/bundle.tgz" .
echo '<!doctype html><title>staging</title>' > "$T/stage/index.html"
SHA=$(sha256sum "$T/stage/bundle.tgz" | cut -d' ' -f1)
URL=$(npx -y @shipstatic/ship "$T/stage" --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["url"])')
echo "BUNDLE_LINE: $URL/bundle.tgz $SHA"
