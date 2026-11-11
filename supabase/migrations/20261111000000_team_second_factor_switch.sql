-- The team's second factor, behind one switch (E33, owner's decision of 2026-11-11). The admin
-- panel used to require a two-factor session (aal2) in private.is_admin(); the owner turned that
-- off for now. Nothing is deleted: the switch below decides, and turning it back on restores the
-- behaviour of E15 at once, with no code change.
--
-- TEMPORARY: turn back on with:
--   update public.team_settings set require_second_factor = true;
--
-- What keeps protecting the panel with the switch off: the admins list (rows only the owner
-- adds), RLS on every table, the origin check on POST, the separate admin host with its own
-- session, noindex, the append-only decision log and the sign-in rate limits. A password-reset
-- (recovery) session is never an admin, whatever the switch says.

-- 1. The switch: one row, readable only through the function below, written only by the owner.
create table public.team_settings (
  id boolean primary key default true check (id),
  require_second_factor boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.team_settings enable row level security;
revoke all on public.team_settings from anon, authenticated;

-- TEMPORARY (owner's decision of 2026-11-11): off for now. Turn back on with:
--   update public.team_settings set require_second_factor = true;
insert into public.team_settings (id, require_second_factor) values (true, false);

-- The switch's value; without the row (never expected), the second factor is required.
create function private.second_factor_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select require_second_factor from public.team_settings where id), true);
$$;

-- For the interface (the admin layout, the sign-in route): whether to ask for the code.
create function public.second_factor_required()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.second_factor_required(); $$;

revoke execute on function private.second_factor_required() from public, anon;
revoke execute on function public.second_factor_required() from public, anon;
grant execute on function private.second_factor_required() to authenticated;
grant execute on function public.second_factor_required() to authenticated;

-- 2. Who is an admin: on the list, never in a recovery session, and with the second factor when
-- the switch asks for it. private.is_admin_member() (on the list at all) is unchanged.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
    -- A password-reset session (E30) only ever reaches the reset page.
    and not coalesce(
      ((select auth.jwt()) -> 'amr') @> '[{"method": "recovery"}]'::jsonb,
      false
    )
    and (
      not private.second_factor_required()
      or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    );
$$;
