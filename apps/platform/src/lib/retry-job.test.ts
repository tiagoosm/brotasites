import { describe, expect, it } from "vitest";
import { type RetryJobRow, retriesUsed, retryPlan, retryRefusals } from "./retry-job";

const NOW = new Date("2026-11-12T12:00:00Z");
const ADMIN = "a0000000-0000-4000-8000-000000000001";

function job(extra: Partial<RetryJobRow> & Pick<RetryJobRow, "id">): RetryJobRow {
  return {
    kind: "build",
    status: "failed",
    payload: { direction: "d1" },
    created_at: "2026-11-12T10:00:00Z",
    ...extra,
  };
}

describe("retryPlan (E39)", () => {
  it("runs the newest failed step again with the same payload, marked as a retry", () => {
    const plan = retryPlan(
      "needs_attention",
      [
        job({ id: "old", kind: "directions", status: "done", created_at: "2026-11-12T08:00:00Z" }),
        job({ id: "build-1" }),
      ],
      ADMIN,
      NOW,
    );
    expect(plan).toEqual({
      ok: true,
      kind: "build",
      failedJobId: "build-1",
      nextStatus: "building",
      payload: { direction: "d1", retryOf: "build-1", retriedBy: ADMIN },
      used: 0,
      limit: 3,
    });
  });

  it("sends each step to its own working status", () => {
    for (const [kind, status] of [
      ["directions", "generating_directions"],
      ["build", "building"],
      ["publish", "publishing"],
    ] as const) {
      const plan = retryPlan("needs_attention", [job({ id: "j", kind })], ADMIN, NOW);
      expect(plan.ok && plan.nextStatus).toBe(status);
    }
  });

  it("refuses a site that does not need attention", () => {
    expect(retryPlan("building", [job({ id: "j" })], ADMIN, NOW)).toMatchObject({
      ok: false,
      reason: "wrong_status",
    });
  });

  it("refuses while a job is queued or running", () => {
    const jobs = [
      job({ id: "a" }),
      job({ id: "b", status: "running", created_at: "2026-11-12T11:00:00Z" }),
    ];
    expect(retryPlan("needs_attention", jobs, ADMIN, NOW)).toMatchObject({
      ok: false,
      reason: "in_progress",
    });
  });

  it("refuses when the newest job did not fail", () => {
    expect(
      retryPlan("needs_attention", [job({ id: "a", status: "done" })], ADMIN, NOW),
    ).toMatchObject({ ok: false, reason: "nothing_failed" });
    expect(retryPlan("needs_attention", [], ADMIN, NOW)).toMatchObject({
      ok: false,
      reason: "nothing_failed",
    });
  });

  it("counts only this action's retries of the last 24 hours, up to the limit", () => {
    const retries = [
      job({ id: "r1", payload: { retryOf: "x" }, created_at: "2026-11-12T09:00:00Z" }),
      job({ id: "r2", payload: { retryOf: "r1" }, created_at: "2026-11-12T09:30:00Z" }),
      job({ id: "old", payload: { retryOf: "y" }, created_at: "2026-11-10T09:00:00Z" }),
      job({ id: "client", payload: { rebuild: true }, created_at: "2026-11-12T09:45:00Z" }),
    ];
    expect(retriesUsed(retries, NOW)).toBe(2);
    const third = retryPlan("needs_attention", retries, ADMIN, NOW);
    expect(third).toMatchObject({ ok: true, used: 2 });
    // A retry of a retry points at the newest failure only.
    expect(third.ok && third.payload).toEqual({
      rebuild: true,
      retryOf: "client",
      retriedBy: ADMIN,
    });
    const fourth = [
      ...retries,
      job({ id: "r3", payload: { retryOf: "r2" }, created_at: "2026-11-12T11:00:00Z" }),
    ];
    expect(retryPlan("needs_attention", fourth, ADMIN, NOW)).toMatchObject({
      ok: false,
      reason: "limit",
      used: 3,
    });
    expect(retryRefusals.limit[0]).toBe(429);
  });
});
