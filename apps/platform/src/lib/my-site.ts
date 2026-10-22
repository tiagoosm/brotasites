import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteStatus = "draft" | "generating" | "publishing" | "live" | "in_review" | "failed";

export interface MySite {
  id: string;
  subdomain: string | null;
  status: SiteStatus;
}

/** Where published sites live. */
export const SITES_DOMAIN = process.env.NEXT_PUBLIC_SITES_DOMAIN ?? "brotasites.com";
/**
 * While the domain is not set up, sites open on the sites Worker's workers.dev address by
 * path (e.g. https://brotasites-sites.<account>.workers.dev). Leave empty in production.
 */
const TEST_URL = process.env.NEXT_PUBLIC_SITES_TEST_URL?.replace(/\/+$/, "");

export function siteUrl(subdomain: string, testUrl = TEST_URL): string {
  return testUrl ? `${testUrl}/${subdomain}/` : `https://${subdomain}.${SITES_DOMAIN}`;
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
