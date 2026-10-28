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
  return { supabase, site } as const;
}
