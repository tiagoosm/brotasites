-- Approval and the one-time payment (docs/product.md). The platform's route handlers check
-- who is asking with the person's session, then call these with the secret key, passing the
-- price from apps/platform/src/config/pricing.ts (the only place prices live). Errors are
-- stable codes: site_not_found, wrong_status, no_subdomain, payment_not_found.

-- The client approves the finished site. Returns {"paymentId": ...} for the payment to make,
-- or {"jobId": ...} when publishing was already paid and the site goes to "publishing".
create function public.server_approve(p_site_id uuid, p_amount_cents integer, p_provider text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  site public.sites%rowtype;
  payment_id uuid;
  job_id uuid;
begin
  select * into site from public.sites where id = p_site_id for update;
  if not found then raise exception 'site_not_found'; end if;
  if site.status <> 'awaiting_approval' or site.approved_direction is null then
    raise exception 'wrong_status';
  end if;
  if site.subdomain is null then raise exception 'no_subdomain'; end if;

  update public.sites set approved_at = coalesce(approved_at, now()) where id = p_site_id;

  if exists (
    select 1 from public.payments
    where site_id = p_site_id and purpose = 'publish' and status = 'paid'
  ) then
    update public.sites set status = 'publishing', status_message = null where id = p_site_id;
    insert into public.jobs (site_id, kind) values (p_site_id, 'publish') returning id into job_id;
    perform private.add_event(p_site_id, 'approved', 'Site aprovado. Estamos colocando no ar.');
    return jsonb_build_object('jobId', job_id);
  end if;

  select id into payment_id from public.payments
    where site_id = p_site_id and purpose = 'publish' and status = 'pending'
      and provider = p_provider and amount_cents = p_amount_cents
    order by created_at desc
    limit 1;
  if payment_id is null then
    insert into public.payments (site_id, purpose, provider, amount_cents)
      values (p_site_id, 'publish', p_provider, p_amount_cents)
      returning id into payment_id;
    perform private.add_event(p_site_id, 'approved', 'Site aprovado. Falta o pagamento para colocar no ar.');
  end if;
  return jsonb_build_object('paymentId', payment_id);
end;
$$;

-- A payment was confirmed (the stub now; the Asaas webhook later). Paying twice is a no-op.
-- Returns the publish job when the approved site can go live, or null.
create function public.server_confirm_payment(p_payment_id uuid, p_external_id text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  payment public.payments%rowtype;
  site public.sites%rowtype;
  job_id uuid;
begin
  select * into payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found'; end if;
  if payment.status = 'pending' then
    update public.payments
      set status = 'paid', paid_at = now(), external_id = p_external_id
      where id = p_payment_id;
    perform private.add_event(payment.site_id, 'payment_confirmed', 'Pagamento confirmado.');
  elsif payment.status <> 'paid' then
    raise exception 'wrong_status';
  end if;

  select * into site from public.sites where id = payment.site_id for update;
  if payment.purpose = 'publish' and site.status = 'awaiting_approval' and site.approved_at is not null then
    update public.sites set status = 'publishing', status_message = null where id = site.id;
    insert into public.jobs (site_id, kind) values (site.id, 'publish') returning id into job_id;
    perform private.add_event(site.id, 'publishing', 'Estamos colocando o seu site no ar.');
  end if;
  return job_id;
end;
$$;

revoke execute on function public.server_approve(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.server_confirm_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.server_approve(uuid, integer, text) to service_role;
grant execute on function public.server_confirm_payment(uuid, text) to service_role;
