import { NO_STORE } from "@/lib/server/guard";
import { currentUser } from "@/lib/server/session";

// "Baixar meus dados" (LGPD): the profile, the accepted terms and every site with its answers,
// configuration, directions, history and charges, read with the person's own session (RLS).
// No secrets: no preview token, no internal ids of other people, no keys.
export async function GET() {
  const session = await currentUser();
  if ("error" in session) return session.error;
  const { supabase, user } = session;
  const [profile, terms, sites] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, phone, terms_version, terms_accepted_at, has_password, created_at, updated_at",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("terms_acceptances").select("terms_version, accepted_at").order("accepted_at"),
    supabase
      .from("sites")
      .select(
        "id, subdomain, status, schema_version, round, status_message, approved_at, published_at, created_at, updated_at, site_configs(draft, completed, config, updated_at), site_directions(round, direction, identity, source, created_at), site_events(kind, message, created_at), payments(purpose, provider, status, amount_cents, created_at, paid_at)",
      )
      .order("created_at"),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      createdAt: user.created_at,
      emailConfirmedAt: user.email_confirmed_at,
    },
    profile: profile.data,
    termsAccepted: terms.data ?? [],
    sites: sites.data ?? [],
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      ...NO_STORE,
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="meus-dados-brotasites.json"',
    },
  });
}
