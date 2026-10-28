// Starts a queued job on Trigger.dev (docs/hosting.md). The job row is the source of truth:
// without TRIGGER_SECRET_KEY (development), or if triggering fails, the job stays queued for the
// local runner (pnpm --filter @brotasites/jobs dev:local) or the next trigger.

export async function triggerJob(jobId: string): Promise<boolean> {
  if (!process.env.TRIGGER_SECRET_KEY) return false;
  try {
    const { tasks } = await import("@trigger.dev/sdk");
    await tasks.trigger("site-job", { jobId });
    return true;
  } catch {
    return false;
  }
}
