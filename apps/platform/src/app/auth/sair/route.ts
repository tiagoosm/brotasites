import { type NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/guard";
import { safeNextPath } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

// Signing out is a POST from the platform's own pages (a form button), so a link, a prefetch
// or another site can never log someone out.
export async function POST(request: NextRequest) {
  if (sameOrigin(request)) {
    const supabase = await getServerSupabase();
    await supabase?.auth.signOut();
  }
  const form = await request.formData().catch(() => null);
  const next = safeNextPath(form?.get("voltar")?.toString());
  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
