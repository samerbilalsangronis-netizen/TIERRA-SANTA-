#!/usr/bin/env bash
# Aplica shim + migraciones en una BD Postgres temporal y corre la prueba SQL de extremo a extremo.
# Usa las variables estándar de libpq: PGHOST, PGPORT, PGUSER, PGPASSWORD.
# Ej.: PGHOST=localhost PGPORT=5432 PGUSER=postgres scripts/probar-sql.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="ts_prueba_$$"
psql -d postgres -qc "create database $DB"
trap 'psql -d postgres -qc "drop database if exists $DB" >/dev/null' EXIT
for f in supabase/tests/shim_supabase.sql supabase/migrations/*.sql; do
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/flujo_factura.sql 2>&1 | grep -E "ok:|FALLIDA|PASARON|ERROR" | sed 's/^psql:[^ ]* //'
