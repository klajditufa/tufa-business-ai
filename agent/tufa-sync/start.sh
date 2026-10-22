#!/bin/sh
# Starts CIS Client. The first run creates a private Python environment in .venv.
set -e
cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
	echo "Python 3.9 or newer is required: https://www.python.org/downloads/" >&2
	exit 1
fi

if [ ! -x .venv/bin/python ]; then
	echo "Setting up (first run only)..."
	"$PYTHON" -m venv .venv
fi
if [ ! -f .venv/.installed ] || [ requirements.txt -nt .venv/.installed ]; then
	.venv/bin/python -m pip install --quiet --disable-pip-version-check --upgrade pip
	.venv/bin/python -m pip install --quiet --disable-pip-version-check -r requirements.txt
	touch .venv/.installed
fi

exec .venv/bin/python -m cis_client "$@"
