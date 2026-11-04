#!/usr/bin/env bash
# Two requests at the same time, from two sessions (cost limits, E24): a second site in progress
# and a second round of directions must not both pass. Called by run.sh with the database up.
#   race.sh <psql connection args...>
set -euo pipefail
psql_q() { psql "$@" -v ON_ERROR_STOP=1 -qtA; }

psql_q "$@" <<'SQL'
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('81111111-1111-4111-8111-111111111111', 'race@brotasites.test', 'authenticated', 'authenticated', now());
SQL

# Two new sites at once: one waits on the other's lock, then finds the place taken.
attempt() {
  psql "$@" -qtA -c "set role service_role; begin; select public.server_create_site('81111111-1111-4111-8111-111111111111', 1, '{}'); select pg_sleep(1); commit;" 2>&1 || true
}
attempt "$@" >"$TMPDIR/race-1" & attempt "$@" >"$TMPDIR/race-2" & wait
created="$(psql_q "$@" -c "select count(*) from public.sites where owner_id = '81111111-1111-4111-8111-111111111111'")"
refused="$(cat "$TMPDIR/race-1" "$TMPDIR/race-2" | grep -c site_in_progress || true)"
if [ "$created" != "1" ] || [ "$refused" != "1" ]; then
  echo "FAIL race: $created sites created, $refused refused"; exit 1
fi

# Two rounds of directions at once on that site: the row lock lets one start.
site="$(psql_q "$@" -c "select id from public.sites where owner_id = '81111111-1111-4111-8111-111111111111'")"
ask() {
  psql "$@" -qtA -c "set role service_role; begin; select public.server_request_directions('$site', '81111111-1111-4111-8111-111111111111', 3, 3600); select pg_sleep(1); commit;" 2>&1 || true
}
ask "$@" >"$TMPDIR/race-3" & ask "$@" >"$TMPDIR/race-4" & wait
rounds="$(psql_q "$@" -c "select direction_rounds from public.sites where id = '$site'")"
jobs="$(psql_q "$@" -c "select count(*) from public.jobs where site_id = '$site'")"
if [ "$rounds" != "1" ] || [ "$jobs" != "1" ]; then
  echo "FAIL race: $rounds rounds and $jobs jobs from two clicks"; exit 1
fi
echo "ok   race.sh (two sites at once, two rounds at once)"
