import type { SupabaseClient } from "@supabase/supabase-js";
import { limits } from "@/config/limits";
import { setHostingState } from "./hosting";
import { cleanUpRemovedSite, type RemovalDeps, type Removed } from "./site-removal";

// Taking a site offline and deleting it (E42). The database decides and records
// (server_take_offline, server_restore_online, server_request_deletion, server_cancel_deletion,
// server_delete_site_now); then the hosting follows. Order matters: the KV state changes first,
// so a site never stays on the air because a later cleanup failed; cleanups never throw and are
// retried by their queues (site_purges, domain_purges) and the daily routine.

export type Actor = "owner" | "admin";

export interface TakedownAnswer {
  status: string;
  changed: boolean;
  subdomain: string | null;
  ownerId: string;
  deleteAfter?: string;
}

export interface DeletedAnswer extends Removed {
  retainedPayments?: number;
  already?: boolean;
}

export interface TakedownDeps extends RemovalDeps {
  setState?: typeof setHostingState;
}

/** The KV state a site status maps to (the Worker's). */
export function hostingStateOf(status: string): "active" | "grace" | "offline" {
  if (status === "grace") return "grace";
  if (status === "live") return "active";
  return "offline";
}

/** Syncs the hosting with the site's new status; "failed" is logged, never thrown. */
export async function syncHosting(
  answer: Pick<TakedownAnswer, "status" | "subdomain">,
  deps: TakedownDeps = {},
): Promise<"synced" | "not-published" | "off" | "failed" | "none"> {
  if (!answer.subdomain) return "none";
  return (deps.setState ?? setHostingState)(answer.subdomain, hostingStateOf(answer.status)).catch(
    () => "failed" as const,
  );
}

/**
 * After the database deleted a site: offline in KV first (the site stops answering, on its
 * address and on the client's own domain, which maps to the same record), then the files, the
 * preview and the R2 cleanup. The domain's KV keys and its Cloudflare hostname go through
 * domain_purges, queued by the database when the site row went.
 */
export async function cleanUpDeletedSite(
  db: SupabaseClient,
  deleted: DeletedAnswer,
  deps: TakedownDeps = {},
): Promise<void> {
  if (!deleted.removed) return;
  if (deleted.subdomain)
    await syncHosting({ status: "offline", subdomain: deleted.subdomain }, deps);
  await cleanUpRemovedSite(db, deleted, deps);
}

/** The pt-BR answer for a database code, and its HTTP status. */
export function takedownError(message: string | undefined): [number, string] {
  const codes: [string, number, string][] = [
    ["site_not_found", 404, "Site não encontrado."],
    ["not_admin", 403, "Esta área é só para a equipe."],
    [
      "not_published",
      409,
      "Este site ainda não foi publicado. Se quiser, descarte-o na página dele.",
    ],
    [
      "busy",
      409,
      "O site está sendo atualizado ou publicado agora. Tente de novo quando terminar.",
    ],
    [
      "suspended",
      409,
      "Este site está suspenso pela nossa equipe. Fale com a gente para resolver.",
    ],
    [
      "deletion_scheduled",
      409,
      "Este site tem uma exclusão agendada. Cancele a exclusão antes de recolocar no ar.",
    ],
    [
      "not_yours",
      409,
      "Quem tirou o site do ar foi a nossa equipe. Fale com a gente para recolocar.",
    ],
    ["reason_required", 400, "Escolha o motivo e escreva uma nota: o registro precisa dela."],
    ["not_due", 409, "Esta exclusão ainda não venceu."],
    [
      "withdrawal_expired",
      409,
      "O prazo para desistir com devolução do valor (7 dias depois do pagamento) já terminou.",
    ],
    ["not_found", 404, "Pedido não encontrado."],
    [
      "withdrawn",
      409,
      "Você desistiu da compra: a exclusão segue. Se foi engano, fale com a gente.",
    ],
    ["wrong_status", 409, "Este passo não está disponível agora. Atualize a página."],
    ["bad_request", 400, "Pedido inválido."],
  ];
  const found = codes.find(([code]) => message?.includes(code));
  return found
    ? [found[1], found[2]]
    : [503, "Não foi possível fazer isso agora. Tente de novo em instantes."];
}

export interface ScheduledResult {
  deleted: number;
  failed: number;
}

/** The daily routine's part (E42): scheduled deletions that are due, once each, retried on failure. */
export async function runScheduledDeletions(
  db: SupabaseClient,
  deps: TakedownDeps & { log?: (message: string) => void } = {},
): Promise<ScheduledResult> {
  const result: ScheduledResult = { deleted: 0, failed: 0 };
  const due = await db.rpc("server_due_deletions", { p_limit: limits.deletionBatch });
  if (due.error) {
    deps.log?.(`scheduled deletions list failed: ${due.error.message}`);
    return result;
  }
  for (const row of (due.data ?? []) as { site_id: string }[]) {
    const deleted = await db.rpc("server_delete_site_now", {
      p_site_id: row.site_id,
      p_actor: "system",
      p_actor_id: null,
      p_note: null,
    });
    if (deleted.error) {
      result.failed += 1;
      deps.log?.(`scheduled deletion of ${row.site_id} failed: ${deleted.error.message}`);
      await db
        .rpc("server_deletion_failed", { p_site_id: row.site_id, p_error: deleted.error.message })
        .then(
          () => undefined,
          () => undefined,
        );
      continue;
    }
    result.deleted += 1;
    await cleanUpDeletedSite(db, deleted.data as DeletedAnswer, deps);
  }
  return result;
}
