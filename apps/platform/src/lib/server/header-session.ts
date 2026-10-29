import type { HeaderSession } from "@/components/site/nav";
import { getServerSupabase } from "@/lib/supabase/server";

// Who the header is for on the signed-in and account pages (E17), read on the server with the
// person's session: the name from the profile, the email, and whether they are on the team
// (is_admin_member, RLS-safe). The team flag only shows a link; /admin checks on the server.

export interface Who {
  name: string;
  email: string;
  team: boolean;
}

/** The signed-in person's name, email and team flag, or null without a session. */
export async function whoIsSignedIn(): Promise<Who | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [profile, member] = await Promise.all([
    supabase.from("profiles").select("full_name").maybeSingle(),
    supabase.rpc("is_admin_member"),
  ]);
  return {
    name: ((profile.data as { full_name?: string } | null)?.full_name ?? "").trim(),
    email: data.user.email ?? "",
    team: member.data === true,
  };
}

export async function headerSession(): Promise<HeaderSession> {
  const who = await whoIsSignedIn().catch(() => null);
  return who ? { signedIn: true, known: true, ...who } : { signedIn: false };
}
