#!/usr/bin/env bash
# Levanta (o revive) el entorno local de pruebas en un contenedor Linux en la nube:
#   - Postgres "pelado" en /var/tmp/pgts:54329 para la prueba SQL (scripts/probar-sql.sh)
#   - Docker + Supabase local (API en 127.0.0.1:54321, Postgres en 54322)
#   - la app ya compilada con `next start` en el puerto 3000
# Los contenedores se reciclan entre turnos y todo se cae: correr esto antes de probar.
# Primera vez: ver HANDOFF.md §11 (initdb, supabase start, .env.local, usuario admin).
set -u
cd "$(dirname "$0")/.."
PG=/usr/lib/postgresql/16/bin
if [ -d /var/tmp/pgts/data ]; then
  su postgres -c "$PG/pg_ctl -D /var/tmp/pgts/data -o '-p 54329 -k /var/tmp/pgts' -l /var/tmp/pgts/log status" >/dev/null 2>&1 || {
    rm -f /var/tmp/pgts/data/postmaster.pid   # solo si no está corriendo
    su postgres -c "$PG/pg_ctl -D /var/tmp/pgts/data -o '-p 54329 -k /var/tmp/pgts' -l /var/tmp/pgts/log start" >/dev/null; }
fi
if ! docker info >/dev/null 2>&1; then
  rm -f /var/run/docker.pid /var/run/docker.sock
  (setsid dockerd > /var/tmp/dockerd.log 2>&1 &)
  for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
fi
docker start $(docker ps -aq) >/dev/null 2>&1
for _ in $(seq 1 90); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/auth/v1/health | grep -q 200 && break; sleep 2; done
if [ -d .next ]; then
  curl -s -o /dev/null http://localhost:3000/ || (setsid npx next start -p 3000 > /var/tmp/next.log 2>&1 &)
  sleep 3
fi
echo "supabase $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/auth/v1/health) · next $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
