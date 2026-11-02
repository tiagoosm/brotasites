import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

// Keeps the Supabase project awake. Supabase pauses Free plan projects that get too few
// database queries over a week ("a few user requests to the database each day" is enough,
// docs/hosting.md). Vercel Cron calls this once a day (vercel.json) with the CRON_SECRET as a
// bearer token; anyone else gets 401. Read-only: it counts rows and changes nothing.

const TABLES = ["sites", "profiles", "notifications"] as const;

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  const noStore = { "cache-control": "no-store" };
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
  // Several separate queries, each one a real query in the database.
  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return { table, ok: !error, count: count ?? null };
    }),
  );
  const ok = results.every((result) => result.ok);
  return NextResponse.json(
    { ok, at: new Date().toISOString(), queries: results.map(({ table, ok }) => ({ table, ok })) },
    { status: ok ? 200 : 502, headers: noStore },
  );
}
