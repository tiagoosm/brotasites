import { describe, expect, it } from "vitest";
import { isStuck, runningCutoff, STUCK_JOB_MINUTES, STUCK_RUNNING_MINUTES } from "./stuck-job";

const now = new Date("2026-11-12T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("a job stuck in the queue (E34)", () => {
  it("is a queued job older than the limit", () => {
    expect(STUCK_JOB_MINUTES).toBe(15);
    expect(isStuck({ id: "j", status: "queued", created_at: ago(16) }, now)).toBe(true);
    expect(isStuck({ id: "j", status: "queued", created_at: ago(14) }, now)).toBe(false);
  });

  it("never a finished or missing one", () => {
    for (const status of ["done", "failed"]) {
      expect(isStuck({ id: "j", status, created_at: ago(600) }, now), status).toBe(false);
    }
    expect(isStuck(null, now)).toBe(false);
  });
});

describe("a job left running by a dead process (E37)", () => {
  it("is a running job that started longer ago than the limit", () => {
    expect(STUCK_RUNNING_MINUTES).toBe(45);
    // The OOM case: started, the process was killed, nothing marked the job.
    const killed = { id: "j", status: "running", created_at: ago(120), started_at: ago(46) };
    expect(isStuck(killed, now)).toBe(true);
  });

  it("gives a run in progress its time, up to its 30-minute limit and more", () => {
    const working = { id: "j", status: "running", created_at: ago(120), started_at: ago(40) };
    expect(isStuck(working, now)).toBe(false);
  });

  it("falls back to the creation time when the start time is missing", () => {
    expect(isStuck({ id: "j", status: "running", created_at: ago(50) }, now)).toBe(true);
    expect(isStuck({ id: "j", status: "running", created_at: ago(10) }, now)).toBe(false);
  });

  it("gives the cutoff the server uses to requeue it", () => {
    expect(runningCutoff(now)).toBe(ago(45));
  });
});
