import { NextResponse } from "next/server";
import { exportLink } from "@/lib/server/hosting";
import { errors, fail, ownSite } from "@/lib/server/session";

// The client's copy of the published site (docs/product.md: the site belongs to the client):
// a short-lived link to the .zip of the live version, for the owner of a paid, published site.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownSite(id);
  if ("error" in owned) return owned.error;
  const { site, supabase } = owned;
  if (!["live", "grace"].includes(site.status as string) || !site.subdomain) {
    return fail(409, "O download fica disponível depois que o site entra no ar.");
  }
  const { data: paid } = await supabase
    .from("payments")
    .select("id")
    .eq("site_id", id)
    .eq("purpose", "publish")
    .eq("status", "paid")
    .limit(1);
  if (!paid?.length) return fail(409, "O download fica disponível depois do pagamento.");
  const url = exportLink(site.subdomain as string);
  if (!url) return fail(503, errors.unavailable);
  return NextResponse.json({ url }, { headers: { "cache-control": "private, no-store" } });
}
