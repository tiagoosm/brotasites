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

export type AdminContext = { userId: string; db: SupabaseClient };

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
  return { userId: auth.user.id, db };
}

export const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
