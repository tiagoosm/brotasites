import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { errors, fail } from "./session";

// The admin panel's route handlers (E11). The role is checked with the person's own session
// (is_admin, a row the owner adds); only then the handler uses the secret key. Admins never act
// as a client: decisions go through server_admin_decide, which logs who did what.

export const adminErrors = {
  forbidden: "Esta área é só para a equipe.",
  badRequest: "Pedido inválido.",
} as const;

/** The member's id, the secret-key client, and the member's own session (for the E24 panel's reads). */
export type AdminContext = { userId: string; db: SupabaseClient; session: SupabaseClient };

export async function requireAdmin(
  request?: Request,
): Promise<{ error: NextResponse } | AdminContext> {
  // JSON only: a form posted from another site cannot reach these handlers.
  if (request && request.method !== "GET") {
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return { error: fail(415, adminErrors.badRequest) };
    }
  }
  const supabase = await getServerSupabase();
  const db = getAdminSupabase();
  if (!supabase || !db) return { error: fail(503, errors.unavailable) };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: fail(401, errors.signedOut) };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { error: fail(403, adminErrors.forbidden) };
  return { userId: auth.user.id, db, session: supabase };
}

export const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

/** The pt-BR answer for an error of the team panel's database functions (E24). */
export function teamRpcError(message: string | undefined): NextResponse {
  if (message?.includes("forbidden")) return fail(403, adminErrors.forbidden);
  if (message?.includes("bad_request")) return fail(400, adminErrors.badRequest);
  if (message?.includes("not_found")) return fail(404, "Não encontrado.");
  return fail(503, errors.unavailable);
}
