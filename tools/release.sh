#!/usr/bin/env bash
# Usage: tools/release.sh 1.2.0 "What is new, one or two sentences"
# Builds the program-update files the browser downloads from a GitHub release:
#   out/release/limbus-app.zip   the whole app folder
#   out/release/limbus-app.json  {version, sha256, notes, minElectron}
# Commit both into the release/ folder of the update repository (main branch). The browser reads them from there.
set -euo pipefail
V="${1:?version like 1.2.0}"; NOTES="${2:-}"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must look like 1.2.0"; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 - "$V" <<'PY'
import json,sys
p='browser/app/package.json'; j=json.load(open(p)); j['version']=sys.argv[1]; open(p,'w').write(json.dumps(j,indent=2)+"\n")
PY
NO_SEED=1 tools/build_browser.sh >/dev/null
! grep -rq 'seed' browser/app/hub/index.html browser/app/hub/data || { echo 'seed data must not be in a public release'; exit 1; }
for f in main.js boot.js appupdate.js unzip.js; do node --check "browser/app/$f"; done
OUT=out/release; rm -rf "$OUT"; mkdir -p "$OUT"
( cd browser/app && rm -f package-lock.json && zip -qr "$ROOT/$OUT/limbus-app.zip" . -x '*.log' )
SHA=$(sha256sum "$OUT/limbus-app.zip" | cut -d' ' -f1)
python3 - "$V" "$SHA" "$NOTES" <<'PY'
import json,sys
json.dump({"version":sys.argv[1],"sha256":sys.argv[2],"notes":sys.argv[3],"minElectron":"45.0.0"},open('out/release/limbus-app.json','w'),indent=2)
PY
echo "built $OUT (version $V, sha256 $SHA)"
# put the private seed back for the install zip build
tools/build_browser.sh >/dev/null
