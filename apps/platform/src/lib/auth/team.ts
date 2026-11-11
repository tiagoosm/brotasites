import { safeNextPath } from "@/lib/supabase/env";

// The team's own sign-in (E33): /entrar/equipe, where /entrar leads on the team's host. After
// signing in it goes back only to a page of the team's area; anything else is /admin.

export const TEAM_SIGN_IN = "/entrar/equipe";
export const TEAM_HOME = "/admin";

/** A page of the team's area to go back to ("/admin", "/admin/…"), or /admin. */
export function teamNextPath(value: string | null | undefined): string {
  const path = safeNextPath(value, TEAM_HOME);
  return path === TEAM_HOME || /^\/admin[/?#]/.test(path) ? path : TEAM_HOME;
}
