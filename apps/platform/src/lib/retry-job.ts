// "Tentar de novo" in the admin (E39): a site in needs_attention runs its failed step again with
// the same answers, as a new job, without creating another site. The failed job stays as it was,
// so its error is still there to read. Pure rules here; the route does the reads and writes.

import { limits } from "@/config/limits";
import type { SiteStatus } from "./site-status";

export type JobKind = "directions" | "build" | "publish";

export interface RetryJobRow {
  id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

/** The step in the team's words. */
export const jobStepLabels: Record<JobKind, string> = {
  directions: "Criar as 3 direções",
  build: "Montar o site",
  publish: "Publicar",
};

/** Where the site goes while the step runs again (the same status the client's own call sets). */
export const retryStatus: Record<JobKind, SiteStatus> = {
  directions: "generating_directions",
  build: "building",
  publish: "publishing",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type RetryPlan =
  | {
      ok: true;
      kind: JobKind;
      failedJobId: string;
      nextStatus: SiteStatus;
      payload: Record<string, unknown>;
      used: number;
      limit: number;
    }
  | {
      ok: false;
      reason: "wrong_status" | "nothing_failed" | "in_progress" | "limit";
      used: number;
      limit: number;
    };

/** Retries made in the last 24 hours: the jobs this action created (payload.retryOf). */
export function retriesUsed(jobs: RetryJobRow[], now = new Date()): number {
  return jobs.filter(
    (job) =>
      typeof job.payload?.retryOf === "string" &&
      now.getTime() - new Date(job.created_at).getTime() < DAY_MS,
  ).length;
}

/**
 * What "Tentar de novo" would do now. `jobs` are the site's jobs, any order. Only a site in
 * needs_attention whose newest job failed, with nothing queued or running, and under the daily
 * limit.
 */
export function retryPlan(
  siteStatus: string,
  jobs: RetryJobRow[],
  adminId: string,
  now = new Date(),
  limit: number = limits.adminRetriesPerDay,
): RetryPlan {
  const used = retriesUsed(jobs, now);
  if (siteStatus !== "needs_attention") return { ok: false, reason: "wrong_status", used, limit };
  if (jobs.some((job) => job.status === "queued" || job.status === "running")) {
    return { ok: false, reason: "in_progress", used, limit };
  }
  const newest = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (newest?.status !== "failed" || !(newest.kind in retryStatus)) {
    return { ok: false, reason: "nothing_failed", used, limit };
  }
  if (used >= limit) return { ok: false, reason: "limit", used, limit };
  const kind = newest.kind as JobKind;
  // The same work as before; a retry never carries a retry's or a run's own marks forward.
  const { retryOf: _, retriedBy: __, triggerRunId: ___, ...payload } = newest.payload ?? {};
  return {
    ok: true,
    kind,
    failedJobId: newest.id,
    nextStatus: retryStatus[kind],
    payload: { ...payload, retryOf: newest.id, retriedBy: adminId },
    used,
    limit,
  };
}

/** The team's message for a plan that cannot run (pt-BR). */
export const retryRefusals: Record<Exclude<RetryPlan, { ok: true }>["reason"], [number, string]> = {
  wrong_status: [
    409,
    "Só dá para tentar de novo um site que precisa de atenção. Atualize a página.",
  ],
  nothing_failed: [409, "Não há uma etapa com falha para tentar de novo."],
  in_progress: [409, "Já há uma tentativa em andamento. Aguarde ela terminar."],
  limit: [
    429,
    `Limite de ${limits.adminRetriesPerDay} tentativas em 24 horas atingido. Veja a causa do erro antes de tentar de novo.`,
  ],
};
