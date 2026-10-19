#!/usr/bin/env bash
# Ndërton një DB lokale nga zero: shim → migrations → seed → teste.
# Përdorim: scripts/db-local.sh [DATABASE_URL]
# Default: postgres://postgres@localhost:5433/tufa_test
set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_URL="${1:-postgres://postgres@localhost:5433/postgres}"
DB_NAME="tufa_test"
DB_URL="${ADMIN_URL%/*}/$DB_NAME"

echo "→ rikrijoj $DB_NAME"
psql -q "$ADMIN_URL" -c "drop database if exists $DB_NAME" -c "create database $DB_NAME"

echo "→ shim lokal (auth/storage/role)"
psql -q -v ON_ERROR_STOP=1 "$DB_URL" -f supabase/tests/00_local_shim.sql

echo "→ migrations"
for f in supabase/migrations/*.sql; do
  echo "   $f"
  psql -q -v ON_ERROR_STOP=1 "$DB_URL" -f "$f"
done
# Lokalisht: të drejtat që Supabase i jep automatikisht roleve
psql -q "$DB_URL" -c "grant all on all tables in schema public to authenticated, service_role; grant all on all sequences in schema public to authenticated, service_role; grant execute on all functions in schema public to authenticated, service_role;"

echo "→ seed"
for f in supabase/seed/*.sql; do
  echo "   $f"
  psql -q -v ON_ERROR_STOP=1 "$DB_URL" -f "$f"
done

echo "→ teste"
psql -v ON_ERROR_STOP=1 "$DB_URL" -f supabase/tests/10_rls_isolation.sql 2>&1 | grep -E 'NOTICE|ERROR|FAIL|====' | sed 's/psql:[^:]*:[0-9]*: //'
echo "✓ DB lokale gati: $DB_URL"
