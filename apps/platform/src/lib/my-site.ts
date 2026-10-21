import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteStatus = "draft" | "generating" | "publishing" | "live" | "in_review" | "failed";

export interface MySite {
  id: string;
  subdomain: string | null;
  status: SiteStatus;
}

/** Where published sites live. */
export const SITES_DOMAIN = process.env.NEXT_PUBLIC_SITES_DOMAIN ?? "brotasites.com";

export function siteUrl(subdomain: string): string {
  return `https://${subdomain}.${SITES_DOMAIN}`;
}

/** The person's most recently changed site. RLS limits the query to their own rows. */
export async function fetchMySite(supabase: SupabaseClient): Promise<MySite | null> {
  const { data, error } = await supabase
    .from("sites")
    .select("id, subdomain, status")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MySite | null) ?? null;
}
