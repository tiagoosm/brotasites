import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

// The magic link lands here. It carries either a PKCE `code` (default email template) or a
// `token_hash` (recommended template, works when the email is opened on another device).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
  const supabase = await getServerSupabase();
  const failed = NextResponse.redirect(
    `${origin}/entrar?erro=link&voltar=${encodeURIComponent(next)}`,
  );
  if (!supabase) return failed;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing token") };

  return error ? failed : NextResponse.redirect(`${origin}${next}`);
}
