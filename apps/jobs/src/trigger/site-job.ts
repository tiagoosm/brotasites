import { task } from "@trigger.dev/sdk";
import { depsFromEnv } from "../env.js";
import { JOB_KINDS, runJob } from "../pipeline.js";

// The Trigger.dev task (docs/hosting.md). The platform queues a job row with the database
// functions (request_directions, choose_direction, ...) and then triggers this task with its id;
// the row stays the source of truth, so a task that never runs leaves the job queued for the
// local runner or a later trigger.

/**
 * The machine (E37). The default (small-1x: 0.5 vCPU, 0.5 GB) was killed for running out of
 * memory on the first real run: a job runs `astro build` (Vite, Tailwind, sharp) and Chromium
 * for the screenshots and the review. medium-2x: 2 vCPU, 4 GB. A run killed for memory gets one
 * more attempt on large-1x (4 vCPU, 8 GB); nothing else is retried by Trigger.dev.
 */
export const SITE_JOB_MACHINE = "medium-2x" as const;
export const SITE_JOB_OOM_MACHINE = "large-1x" as const;
/** Builds, the review in Chromium and the uploads take minutes, not hours. */
export const SITE_JOB_MAX_DURATION = 1800;

export const siteJob = task({
  id: "site-job",
  machine: SITE_JOB_MACHINE,
  maxDuration: SITE_JOB_MAX_DURATION,
  // Two attempts only so an out-of-memory kill can run again on the bigger machine. Errors the
  // run throws are never retried here (catchError below): runJob already retries a failed job
  // once, then sends the site to needs_attention.
  retry: { maxAttempts: 2, outOfMemory: { machine: SITE_JOB_OOM_MACHINE } },
  catchError: () => ({ skipRetrying: true }),
  queue: { concurrencyLimit: 4 },
  run: async (payload: { jobId: string }, { ctx }) => {
    const deps = depsFromEnv(process.env);
    try {
      // A second attempt only follows a process killed for memory: its job is still "running"
      // with no one working on it. Put it back in the queue so this attempt can take it.
      if (ctx.attempt.number > 1) {
        await deps.store.requeueIfRunning(
          payload.jobId,
          "O processo parou por falta de memória; nova tentativa numa máquina maior.",
        );
      }
      const job = await deps.store.claimJob(JOB_KINDS, payload.jobId);
      if (!job) return { status: "skipped" as const };
      // E39: the admin links the job to this run (Trigger.dev > Runs).
      await deps.store.recordRun(job.id, ctx.run.id).catch(() => undefined);
      let outcome = await runJob(deps, job);
      // The automatic retry runs right away, in the same task.
      while (outcome === "retry") {
        const again = await deps.store.claimJob(JOB_KINDS, job.id);
        if (!again) break;
        outcome = await runJob(deps, again);
      }
      return { status: outcome };
    } finally {
      await deps.close();
    }
  },
});
