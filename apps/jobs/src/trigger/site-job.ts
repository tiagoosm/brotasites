import { task } from "@trigger.dev/sdk";
import { depsFromEnv } from "../env.js";
import { JOB_KINDS, runJob } from "../pipeline.js";

// The Trigger.dev task (docs/hosting.md). The platform queues a job row with the database
// functions (request_directions, choose_direction, ...) and then triggers this task with its id;
// the row stays the source of truth, so a task that never runs leaves the job queued for the
// local runner or a later trigger.

export const siteJob = task({
  id: "site-job",
  // Builds, the review in Chromium and the uploads take minutes, not hours.
  maxDuration: 1800,
  // Retries are ours (runJob retries once, then needs_attention).
  retry: { maxAttempts: 1 },
  queue: { concurrencyLimit: 4 },
  run: async (payload: { jobId: string }) => {
    const deps = depsFromEnv(process.env);
    try {
      const job = await deps.store.claimJob(JOB_KINDS, payload.jobId);
      if (!job) return { status: "skipped" as const };
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
