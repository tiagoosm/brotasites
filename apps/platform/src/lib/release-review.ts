// "Liberar para o cliente" in the admin (E46): a site the automatic review held for a measured
// problem goes to the client as the reviewer left it, after a person read the report. Never
// after a security finding or an invalid config (the report says so: `releasable`), never while
// a job runs, and never for a failed step (that is "Tentar de novo"). Pure rules here; the route
// does the reads and writes.

import type { RetryJobRow } from "./retry-job";

export interface ReleaseReportRow {
  status: string;
  report: { releasable?: unknown } | null;
  created_at: string;
}

export type ReleasePlan =
  | { ok: true; payload: Record<string, unknown> }
  | {
      ok: false;
      reason: "wrong_status" | "in_progress" | "job_failed" | "no_report" | "blocked";
    };

/**
 * What "Liberar para o cliente" would do now. `jobs` and `reports` are the site's, any order.
 * The newest report must be the review's hold (needsAttention) with `releasable`, and the newest
 * job must have finished well (the review held the site; the job itself did not fail).
 */
export function releasePlan(
  siteStatus: string,
  reports: ReleaseReportRow[],
  jobs: RetryJobRow[],
  adminId: string,
): ReleasePlan {
  if (siteStatus !== "needs_attention") return { ok: false, reason: "wrong_status" };
  if (jobs.some((job) => job.status === "queued" || job.status === "running")) {
    return { ok: false, reason: "in_progress" };
  }
  const newestJob = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (newestJob?.status === "failed") return { ok: false, reason: "job_failed" };
  const report = [...reports].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (report?.status !== "needsAttention" || newestJob?.kind !== "build") {
    return { ok: false, reason: "no_report" };
  }
  if (report.report?.releasable !== true) return { ok: false, reason: "blocked" };
  return { ok: true, payload: { release: true, releasedBy: adminId } };
}

/** The team's message for a plan that cannot run (pt-BR). */
export const releaseRefusals: Record<
  Exclude<ReleasePlan, { ok: true }>["reason"],
  [number, string]
> = {
  wrong_status: [409, "Só dá para liberar um site que precisa de atenção. Atualize a página."],
  in_progress: [409, "Há uma tarefa em andamento neste site. Aguarde ela terminar."],
  job_failed: [
    409,
    "A última etapa falhou por erro técnico: use “Tentar de novo” depois de ver a causa.",
  ],
  no_report: [409, "Não há um relatório da revisão segurando este site."],
  blocked: [
    409,
    "O relatório tem um problema de segurança ou uma configuração inválida: o site não pode ser liberado assim.",
  ],
};
