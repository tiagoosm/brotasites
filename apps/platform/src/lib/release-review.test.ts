import { describe, expect, it } from "vitest";
import { type ReleaseReportRow, releasePlan, releaseRefusals } from "./release-review";
import type { RetryJobRow } from "./retry-job";

const ADMIN = "a0000000-0000-4000-8000-000000000001";
const built: RetryJobRow = {
  id: "build-1",
  kind: "build",
  status: "done",
  payload: {},
  created_at: "2026-11-26T10:00:00Z",
};
const held = (releasable: unknown): ReleaseReportRow => ({
  status: "needsAttention",
  report: { releasable },
  created_at: "2026-11-26T10:05:00Z",
});

describe("releasePlan (E46)", () => {
  it("releases a site the review held, marked with who did it", () => {
    expect(releasePlan("needs_attention", [held(true)], [built], ADMIN)).toEqual({
      ok: true,
      payload: { release: true, releasedBy: ADMIN },
    });
  });

  it("never after a security finding or an invalid config", () => {
    expect(releasePlan("needs_attention", [held(false)], [built], ADMIN)).toEqual({
      ok: false,
      reason: "blocked",
    });
    // A report from before E46 says nothing: not releasable.
    expect(releasePlan("needs_attention", [held(undefined)], [built], ADMIN)).toMatchObject({
      reason: "blocked",
    });
  });

  it("not for a failed step, nor while a job runs, nor twice (the status is the lock)", () => {
    expect(
      releasePlan("needs_attention", [held(true)], [{ ...built, status: "failed" }], ADMIN),
    ).toMatchObject({ reason: "job_failed" });
    expect(
      releasePlan("needs_attention", [held(true)], [{ ...built, status: "running" }], ADMIN),
    ).toMatchObject({ reason: "in_progress" });
    // The first click moved the site to building: a second one is refused.
    expect(releasePlan("building", [held(true)], [built], ADMIN)).toMatchObject({
      reason: "wrong_status",
    });
  });

  it("needs the review's hold as the newest report", () => {
    expect(releasePlan("needs_attention", [], [built], ADMIN)).toMatchObject({
      reason: "no_report",
    });
    expect(
      releasePlan(
        "needs_attention",
        [held(true), { status: "passed", report: {}, created_at: "2026-11-26T11:00:00Z" }],
        [built],
        ADMIN,
      ),
    ).toMatchObject({ reason: "no_report" });
  });

  it("explains every refusal", () => {
    for (const [status, text] of Object.values(releaseRefusals)) {
      expect(status).toBe(409);
      expect(text.length).toBeGreaterThan(10);
    }
  });
});
