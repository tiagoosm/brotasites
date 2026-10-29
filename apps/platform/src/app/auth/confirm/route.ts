import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

// Every link in an email lands here (docs/email-templates): the sign-up confirmation, the
// sign-in link, the password reset and the email change. Each carries a single-use token_hash
// (or a PKCE code). The next page is always inside the platform (safeNextPath), taken from
// `next` or from the `next` of the redirect_to the email template passes along.

const TYPES: readonly EmailOtpType[] = [
  "signup",
  "email",
  "magiclink",
  "recovery",
  "email_change",
  "invite",
];

function nextFrom(url: URL): string {
  const direct = url.searchParams.get("next");
  if (direct) return safeNextPath(direct);
  const redirect = url.searchParams.get("redirect_to");
  if (redirect) {
    try {
      const target = new URL(redirect);
      if (target.origin === url.origin) return safeNextPath(target.searchParams.get("next"));
    } catch {
      // Not a URL: ignored.
    }
  }
  return safeNextPath(null);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { origin, searchParams } = url;
  const next = nextFrom(url);
  const supabase = await getServerSupabase();
  const failed = NextResponse.redirect(
    `${origin}/entrar?erro=link&voltar=${encodeURIComponent(next)}`,
  );
  if (!supabase) return failed;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type") as EmailOtpType | null;
  const type = rawType && TYPES.includes(rawType) ? rawType : null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing token") };
  if (error) return failed;

  if (type === "recovery") return NextResponse.redirect(`${origin}/redefinir-senha`);
  if (type === "email_change") {
    // The new email is confirmed: other devices sign in again with it.
    await supabase.auth.signOut({ scope: "others" });
    return NextResponse.redirect(`${origin}/conta?email=alterado`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
