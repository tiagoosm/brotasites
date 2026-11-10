// The session the "Esqueci a senha" link creates (E30, docs/security.md): a restricted recovery
// session, good only for choosing a new password. It is recognised two ways, so neither alone
// can be dropped to escape it:
// - the session's own sign-in method: the latest real entry of the JWT's amr claim is
//   "recovery" (Supabase records it when the recovery link is verified);
// - a short-lived HttpOnly cookie set by /auth/confirm for that recovery, holding the session's
//   id (so a stale cookie never restricts a later, ordinary session).
// While it lasts (15 minutes), only the reset page, its API and signing out work; protected
// pages lead back to the reset page, the API answers 403, and any other page ends it.

export const RECOVERY_COOKIE = "brotasites_recovery";
export const RECOVERY_SECONDS = 15 * 60;

export interface RecoveryClaims {
  amr?: { method: string; timestamp: number }[];
  session_id?: string;
}

export type RecoveryState = "none" | "active" | "expired";

/** Where the session stands: not a recovery, a live one, or one past its 15 minutes. */
export function recoveryState(
  claims: RecoveryClaims | null | undefined,
  cookie: string | undefined,
  now = Date.now(),
): RecoveryState {
  if (!claims) return "none";
  const entries = (claims.amr ?? []).filter((entry) => entry.method !== "token_refresh");
  const latest = entries.reduce<{ method: string; timestamp: number } | null>(
    (best, entry) => (!best || entry.timestamp > best.timestamp ? entry : best),
    null,
  );
  const byMethod = latest?.method === "recovery";
  const byCookie = Boolean(cookie && claims.session_id && cookie === claims.session_id);
  if (!byMethod && !byCookie) return "none";
  const startedAt = latest?.timestamp ?? 0;
  return now / 1000 - startedAt > RECOVERY_SECONDS ? "expired" : "active";
}

/** What a recovery session may still reach: the reset page, its API, the email links, signing out. */
export function allowedDuringRecovery(path: string): boolean {
  return (
    path === "/redefinir-senha" ||
    path === "/api/account/password" ||
    path === "/auth/sair" ||
    path.startsWith("/auth/")
  );
}

export const recoveryErrors = {
  api: "Termine de criar a nova senha antes de continuar.",
} as const;
