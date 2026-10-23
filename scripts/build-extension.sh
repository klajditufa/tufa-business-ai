#!/usr/bin/env bash
# Paketon shtesën "TUFA · e-Filing" për shkarkim nga TUFA (apps/web/public/tufa-efiling.zip).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f apps/web/public/tufa-efiling.zip
(cd extension && zip -q -r -X ../apps/web/public/tufa-efiling.zip tufa-efiling)
echo "✓ apps/web/public/tufa-efiling.zip"
