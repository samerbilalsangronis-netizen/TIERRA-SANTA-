#!/usr/bin/env bash
# Une todas las migraciones en supabase/instalar.sql para pegarlo en el SQL Editor de Supabase (web).
set -euo pipefail
cd "$(dirname "$0")/.."
{
  echo "-- ====================================================================="
  echo "-- Tierra Santa · INSTALACIÓN COMPLETA DE LA BASE DE DATOS"
  echo "-- Pegar TODO en Supabase → SQL Editor → New query → Run (una sola vez,"
  echo "-- en un proyecto nuevo). Generado con scripts/generar-instalar.sh;"
  echo "-- no editar a mano: editar supabase/migrations/."
  echo "-- ====================================================================="
  for f in supabase/migrations/*.sql; do
    echo
    echo "-- >>> $(basename "$f")"
    cat "$f"
  done
} > supabase/instalar.sql
echo "✔ supabase/instalar.sql ($(wc -l < supabase/instalar.sql) líneas)"
