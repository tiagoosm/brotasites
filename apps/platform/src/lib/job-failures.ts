// The jobs of a site as the team sees them (E39): masked again before they leave the server
// (the jobs mask before storing; rows from before E39 were not), with the step in plain words
// and the known cause. Admin only: the client never gets any of this.

import {
  envSecrets,
  explainJobError,
  type JobErrorCause,
  maskJobError,
  shortJobError,
} from "@brotasites/schema/job-error";
import { type JobKind, jobStepLabels } from "./retry-job";

export interface JobRow {
  id: string;
  kind: string;
  status: string;
  attempts?: number | null;
  error?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface AdminJob {
  id: string;
  kind: string;
  /** "Criar as 3 direções", "Montar o site", "Publicar". */
  step: string;
  status: string;
  attempts: number;
  /** Masked, at most JOB_ERROR_MAX characters. */
  error: string | null;
  cause: JobErrorCause | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** The Trigger.dev run (payload.triggerRunId), for its page in Runs. */
  triggerRunId: string | null;
  /** Made by "Tentar de novo" (E39). */
  retry: boolean;
}

const RUN_ID = /^run_[A-Za-z0-9]{6,40}$/;

export function stepLabel(kind: string): string {
  return jobStepLabels[kind as JobKind] ?? kind;
}

/** The jobs, newest first, ready for the panel. */
export function adminJobs(
  rows: JobRow[],
  env: Record<string, string | undefined> = process.env,
): AdminJob[] {
  const secrets = envSecrets(env);
  return [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => {
      const error = row.error ? maskJobError(row.error, secrets) || null : null;
      const runId = row.payload?.triggerRunId;
      return {
        id: row.id,
        kind: row.kind,
        step: stepLabel(row.kind),
        status: row.status,
        attempts: row.attempts ?? 0,
        error,
        cause: explainJobError(error),
        createdAt: row.created_at,
        startedAt: row.started_at ?? null,
        finishedAt: row.finished_at ?? null,
        triggerRunId: typeof runId === "string" && RUN_ID.test(runId) ? runId : null,
        retry: typeof row.payload?.retryOf === "string",
      };
    });
}

/** The Trigger.dev page of a run. To verify: the dashboard redirects /runs/<id> to the run. */
export function triggerRunUrl(runId: string): string {
  return `https://cloud.trigger.dev/runs/${encodeURIComponent(runId)}`;
}

export interface SiteFailure {
  step: string;
  summary: string;
  /** When the failed job ended (or was created). */
  at: string;
}

/** Each site's newest failed job, in a short line (for the queue and the overview). */
export function failuresBySite(
  rows: (JobRow & { site_id: string })[],
  env: Record<string, string | undefined> = process.env,
): Map<string, SiteFailure> {
  const bySite = new Map<string, (JobRow & { site_id: string })[]>();
  for (const row of rows) bySite.set(row.site_id, [...(bySite.get(row.site_id) ?? []), row]);
  const result = new Map<string, SiteFailure>();
  for (const [siteId, jobs] of bySite) {
    const failed = adminJobs(jobs, env).find((job) => job.status === "failed");
    if (!failed) continue;
    result.set(siteId, {
      step: failed.step,
      summary: shortJobError(failed.error) ?? "Sem mensagem de erro.",
      at: failed.finishedAt ?? failed.createdAt,
    });
  }
  return result;
}

/**
 * E39: the team's complement to a "job_failed" entry of the history: the failed job that ended
 * closest to it (within 5 minutes), as "Montar o site: <short cause>". Null when none matches.
 */
export function failureNoteFor(eventAt: string, jobs: AdminJob[]): string | null {
  const at = new Date(eventAt).getTime();
  let best: { job: AdminJob; gap: number } | null = null;
  for (const job of jobs) {
    if (job.status !== "failed") continue;
    const gap = Math.abs(new Date(job.finishedAt ?? job.createdAt).getTime() - at);
    if (gap <= 5 * 60_000 && (!best || gap < best.gap)) best = { job, gap };
  }
  if (!best) return null;
  return `${best.job.step}: ${shortJobError(best.job.error) ?? "sem mensagem de erro"}`;
}
