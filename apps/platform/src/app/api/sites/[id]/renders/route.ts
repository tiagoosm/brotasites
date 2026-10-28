import { NextResponse } from "next/server";
import { errors, fail, ownSite } from "@/lib/server/session";
import { getAdminSupabase } from "@/lib/supabase/admin";

const RENDERS_BUCKET = "site-renders";
const SIGNED_SECONDS = 3600;

// Short-lived addresses for the screenshots of the current directions (a private bucket that
// only the server reads), for the owner of the site.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownSite(id);
  if ("error" in owned) return owned.error;
  const { data: directions } = await owned.supabase
    .from("site_directions")
    .select("screenshots")
    .eq("site_id", id);
  const paths = (directions ?? [])
    .flatMap((row) => (row.screenshots as string[] | null) ?? [])
    .filter((path) => path.startsWith(`${id}/`));
  if (paths.length === 0) return NextResponse.json({});
  const admin = getAdminSupabase();
  if (!admin) return fail(503, errors.unavailable);
  const { data } = await admin.storage.from(RENDERS_BUCKET).createSignedUrls(paths, SIGNED_SECONDS);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return NextResponse.json(urls, { headers: { "cache-control": "private, no-store" } });
}
