import { type NextRequest, NextResponse } from "next/server";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { sameOrigin } from "@/lib/server/guard";
import { safeNextPath } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

// Signing out is a POST from the platform's own pages (a form button), so a link, a prefetch
// or another site can never log someone out. "escopo=local" ends only this session: the reset
// page sends it when the person leaves without choosing a password (E30).
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (sameOrigin(request)) {
    const supabase = await getServerSupabase();
    const scope = form?.get("escopo") === "local" ? "local" : "global";
    await supabase?.auth.signOut({ scope });
  }
  const next = safeNextPath(form?.get("voltar")?.toString(), "/");
  const done = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  done.cookies.delete(RECOVERY_COOKIE);
  return done;
}
