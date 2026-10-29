import { deleteAccountSchema } from "@/lib/auth/schemas";
import { DeletionError, deleteAccount } from "@/lib/server/account-deletion";
import { guardErrors, json, readBody, refuse } from "@/lib/server/guard";
import { accountErrors, currentUser, sessionClaims, signedInRecently } from "@/lib/server/session";
import { getAdminSupabase } from "@/lib/supabase/admin";

// "Excluir minha conta": the person types their email and must have signed in in the last 10
// minutes. Only then the server uses the secret key (lib/server/account-deletion.ts).
export async function POST(request: Request) {
  const body = await readBody(request, deleteAccountSchema);
  if ("error" in body) return body.error;
  const session = await currentUser();
  if ("error" in session) return session.error;
  const { supabase, user } = session;
  if (body.data.email !== user.email?.toLowerCase()) {
    const message = "Escreva o e-mail desta conta para confirmar.";
    return refuse(400, message, { email: message });
  }
  if (!signedInRecently((await sessionClaims(supabase))?.amr)) {
    return json({ error: accountErrors.reauth, reauth: true }, 403);
  }
  const db = getAdminSupabase();
  if (!db) return refuse(503, guardErrors.unavailable);
  try {
    const result = await deleteAccount(user.id, { db });
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return json({ ok: true, sites: result.sites, retainedPayments: result.retainedPayments });
  } catch (error) {
    if (error instanceof DeletionError && error.message === "is_admin") {
      return refuse(409, "Contas da equipe são removidas pelo responsável pela plataforma.");
    }
    return refuse(503, guardErrors.unavailable);
  }
}
