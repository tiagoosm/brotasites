import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Route handlers act for the signed-in person: they read with the person's session (RLS) to
// prove the site is theirs, and only then use the secret key. Errors are pt-BR for the UI.

export function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export const errors = {
  signedOut: "Entre de novo para continuar.",
  notFound: "Não encontramos este site na sua conta.",
  unavailable: "Isso não está disponível agora. Tente de novo mais tarde.",
} as const;

/** The site row as the person sees it, or null when it is not theirs. */
export async function ownSite(siteId: string) {
  const supabase = await getServerSupabase();
  if (!supabase) return { error: fail(503, errors.unavailable) } as const;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: fail(401, errors.signedOut) } as const;
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return { error: fail(404, errors.notFound) } as const;
  const { data: site } = await supabase
    .from("sites")
    .select("id, status, subdomain, approved_direction")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { error: fail(404, errors.notFound) } as const;
  return { supabase, site, user: auth.user } as const;
}

/** The person behind the request, checked with Supabase Auth (not only the cookie's JWT). */
export async function currentUser() {
  const supabase = await getServerSupabase();
  if (!supabase) return { error: fail(503, errors.unavailable) } as const;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: fail(401, errors.signedOut) } as const;
  return { supabase, user: data.user } as const;
}

/** Seconds a sign-in counts as recent for deleting the account or changing email or password. */
export const RECENT_SIGN_IN_SECONDS = 600;

/**
 * Whether the session's last real sign-in (password, link, recovery, code; not a token refresh)
 * was in the last 10 minutes, from the JWT's amr claim.
 */
export function signedInRecently(
  amr: { method: string; timestamp: number }[] | undefined,
  now = Date.now(),
  maxAge = RECENT_SIGN_IN_SECONDS,
): boolean {
  const latest = Math.max(
    0,
    ...(amr ?? [])
      .filter((entry) => entry.method !== "token_refresh")
      .map((entry) => entry.timestamp),
  );
  return latest > 0 && now / 1000 - latest <= maxAge;
}

/** The session's claims (amr, aal), verified by Supabase. */
export async function sessionClaims(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
) {
  const { data } = await supabase.auth.getClaims();
  return data?.claims as
    | { amr?: { method: string; timestamp: number }[]; aal?: string; session_id?: string }
    | undefined;
}

export const accountErrors = {
  reauth: "Por segurança, confirme que é você: entre de novo e repita o pedido.",
  emailNotConfirmed:
    "Confirme o seu e-mail para continuar. Enviamos um link quando você criou a conta.",
} as const;
