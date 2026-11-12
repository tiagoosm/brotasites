// A job that waits queued too long (E34): the person sees "Tentar de novo", the team a flag on
// the overview. A queued job normally starts within seconds (Trigger.dev); after this many
// minutes it is taken as stuck (the queue was down, or not set up yet).
export const STUCK_JOB_MINUTES = 15;

export interface JobState {
  id: string;
  status: string;
  created_at: string;
}

/** Whether the site's latest job has waited queued past the limit. */
export function isStuck(job: JobState | null | undefined, now: Date = new Date()): boolean {
  if (!job || job.status !== "queued") return false;
  return now.getTime() - new Date(job.created_at).getTime() > STUCK_JOB_MINUTES * 60_000;
}
