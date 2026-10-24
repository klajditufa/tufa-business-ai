#!/usr/bin/env bash
# Paketon shtesën "TUFA · e-Filing" për shkarkim nga TUFA (apps/web/public/tufa-efiling.zip).
# portal.js gjenerohet nga extension/src/portal.ts (portal.ts i cis-client-2); mos e ndrysho me dorë.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd apps/web && npx esbuild ../../extension/src/portal.ts --bundle --format=iife --global-name=TufaPortal \
  --target=chrome110 --banner:js="// GJENERUAR nga extension/src/portal.ts — mos e ndrysho." \
  --outfile=../../extension/tufa-efiling/portal.js --log-level=warning)
rm -f apps/web/public/tufa-efiling.zip
(cd extension && zip -q -r -X ../apps/web/public/tufa-efiling.zip tufa-efiling)
echo "✓ apps/web/public/tufa-efiling.zip"
