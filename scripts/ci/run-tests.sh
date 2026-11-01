#!/usr/bin/env bash
# Tests used by .github/workflows/feedesk-data-rebuild.yml after a data rebuild.
#   unit    : python unit tests of the rebuild scripts + the 6 pure-node tests (no browser)
#   browser : data-driven Playwright smoke (grid-v9f, entry-window-v9t) against public/ on a private port
#   all     : both
# The Playwright tests load playwright from /workspace/pwtest (hard-coded in tests/helpers/cr-welcome.js), so for "browser"
# that folder must contain a playwright install (the workflow creates it; locally: cd /workspace/pwtest && npm i playwright).
set -uo pipefail
cd "$(dirname "$0")/../.."
mode="${1:-all}"; fails=0
unit() {
  python3 -m unittest discover -s tests -p 'test_*.py' || fails=$((fails+1))
  for t in alberta-time-2026 claims-cutoff ew-photo-b11 scan-parse-b11 sex-b11 shared-rowfmt-vendor; do
    echo "== node tests/$t.test.js"; node "tests/$t.test.js" | tee /tmp/node-$t.log | tail -1
    if [ "${PIPESTATUS[0]}" != 0 ] || grep -q '^FAIL' /tmp/node-$t.log; then fails=$((fails+1)); echo "FAILED: $t"; fi
  done
}
browser() {
  local port="${SMOKE_PORT:-18971}" srv; srv="$(mktemp -d)"; ln -s "$PWD/public" "$srv/medbilling-logs"
  (cd "$srv" && python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 & echo $! > "$srv/pid")
  sleep 1
  for t in grid-v9f entry-window-v9t; do
    echo "== playwright tests/$t.test.js"
    (cd /workspace/pwtest && URL="http://127.0.0.1:$port/medbilling-logs/" OUT="$(mktemp -d)" timeout 600 node "$OLDPWD/tests/$t.test.js") > "/tmp/pw-$t.log" 2>&1
    rc=$?; tail -2 "/tmp/pw-$t.log"
    if [ $rc != 0 ] || grep -q '^FAIL' "/tmp/pw-$t.log"; then fails=$((fails+1)); echo "FAILED: $t"; grep '^FAIL' "/tmp/pw-$t.log" | head; fi
  done
  kill "$(cat "$srv/pid")" 2>/dev/null
}
case "$mode" in unit) unit;; browser) browser;; all) unit; browser;; *) echo "usage: $0 unit|browser|all"; exit 2;; esac
echo "failed groups: $fails"; exit $((fails > 0))
