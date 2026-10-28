#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres (with shim.sql standing in for
# Supabase) and runs the checks in supabase/tests. Each check ends with the exception
# "ALL CHECKS PASSED" on purpose, so it rolls back; anything else fails the run.
#   bash supabase/tests/local/run.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
bin="$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)"
work="$(mktemp -d)"
chmod 777 "$work"
port=55432

as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

cleanup() {
  as_pg "$bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

as_pg "$bin/initdb" -D "$work/data" -U postgres -A trust >/dev/null
as_pg "$bin/pg_ctl" -D "$work/data" -o "-p $port -k $work -c listen_addresses=''" -l "$work/log" -w start >/dev/null

psql_run() {
  psql -h "$work" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

psql_run -f "$here/shim.sql"
for migration in "$root"/supabase/migrations/*.sql; do
  psql_run -f "$migration" || { echo "Migration failed: $(basename "$migration")"; exit 1; }
done
echo "Applied $(ls "$root"/supabase/migrations/*.sql | wc -l) migrations."

failed=0
for check in "$root"/supabase/tests/*.sql; do
  output="$(psql -h "$work" -p "$port" -U postgres -d postgres -q -f "$check" 2>&1 || true)"
  if grep -q "ALL CHECKS PASSED" <<<"$output"; then
    echo "ok   $(basename "$check")"
  else
    echo "FAIL $(basename "$check")"
    echo "$output" | grep -E "ERROR|FAIL" | head -5
    failed=1
  fi
done
exit "$failed"
