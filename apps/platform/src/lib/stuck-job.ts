// A job that waits queued too long (E34): the person sees "Tentar de novo", the team a flag on
// the overview. A queued job normally starts within seconds (Trigger.dev); after this many
// minutes it is taken as stuck (the queue was down, or not set up yet).
export const STUCK_JOB_MINUTES = 15;

// A job left "running" by a process that died (E37: the first real run was killed for using
// too much memory, and nothing marked the job). The jobs stop a run after 30 minutes
// (maxDuration 1800 in apps/jobs/src/trigger/site-job.ts, kept in step by a test there); past
// this many minutes since it started, no process is working on it any more.
export const STUCK_RUNNING_MINUTES = 45;

export interface JobState {
  id: string;
  status: string;
  created_at: string;
  started_at?: string | null;
}

/** Whether the site's latest job waits queued, or "runs" with no process, past its limit. */
export function isStuck(job: JobState | null | undefined, now: Date = new Date()): boolean {
  if (!job) return false;
  if (job.status === "queued") {
    return now.getTime() - new Date(job.created_at).getTime() > STUCK_JOB_MINUTES * 60_000;
  }
  if (job.status === "running") {
    const since = new Date(job.started_at ?? job.created_at).getTime();
    return now.getTime() - since > STUCK_RUNNING_MINUTES * 60_000;
  }
  return false;
}

/** The latest start time a "running" job may have before it counts as abandoned. */
export function runningCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - STUCK_RUNNING_MINUTES * 60_000).toISOString();
}
