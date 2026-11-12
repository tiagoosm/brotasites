import { describe, expect, it } from "vitest";
import { isStuck, STUCK_JOB_MINUTES } from "./stuck-job";

const now = new Date("2026-11-12T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("a job stuck in the queue (E34)", () => {
  it("is a queued job older than the limit", () => {
    expect(STUCK_JOB_MINUTES).toBe(15);
    expect(isStuck({ id: "j", status: "queued", created_at: ago(16) }, now)).toBe(true);
    expect(isStuck({ id: "j", status: "queued", created_at: ago(14) }, now)).toBe(false);
  });

  it("never a running, finished or missing one", () => {
    for (const status of ["running", "done", "failed"]) {
      expect(isStuck({ id: "j", status, created_at: ago(60) }, now), status).toBe(false);
    }
    expect(isStuck(null, now)).toBe(false);
  });
});
