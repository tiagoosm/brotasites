import { describe, expect, it } from "vitest";
import { costOf, dayOf, LimitReached, MemoryUsageStore, SpendingGuard } from "../src/index.js";

const caller = { siteId: "site-1", accountId: "acc-1" };

describe("SpendingGuard", () => {
  it("allows 20 rounds per site and task a day, then refuses", async () => {
    const guard = new SpendingGuard(new MemoryUsageStore());
    for (let i = 0; i < 20; i++) await guard.admit("art-director", caller);
    await expect(guard.admit("art-director", caller)).rejects.toThrow(LimitReached);
    await expect(guard.admit("copy", caller)).resolves.toBeUndefined();
  });

  it("counts the account across its sites", async () => {
    const guard = new SpendingGuard(new MemoryUsageStore(), {
      roundsPerSitePerDay: 20,
      roundsPerAccountPerDay: 3,
      dailyBudgetUsd: 10,
      alertRatio: 0.8,
    });
    for (const siteId of ["a", "b", "c"]) await guard.admit("copy", { siteId, accountId: "acc" });
    await expect(guard.admit("copy", { siteId: "d", accountId: "acc" })).rejects.toThrow(/conta/);
  });

  it("alerts once past the alert ratio and stops at the daily budget", async () => {
    const alerts: number[] = [];
    let now = new Date("2026-10-27T15:00:00Z");
    const guard = new SpendingGuard(
      new MemoryUsageStore(),
      { roundsPerSitePerDay: 99, roundsPerAccountPerDay: 99, dailyBudgetUsd: 1, alertRatio: 0.8 },
      (alert) => alerts.push(alert.spentUsd),
      () => now,
    );
    await guard.record(0.5);
    await guard.record(0.35);
    await guard.record(0.1);
    expect(alerts).toEqual([0.85]);
    await guard.record(0.1);
    await expect(guard.admit("copy", caller)).rejects.toThrow(/orçamento/);
    now = new Date("2026-10-28T15:00:00Z");
    await expect(guard.admit("copy", caller)).resolves.toBeUndefined();
  });

  it("uses the day in Brazil", () => {
    expect(dayOf(new Date("2026-10-28T02:00:00Z"))).toBe("2026-10-27");
  });
});

describe("costOf", () => {
  it("prices tokens by model and errs high on unknown models", () => {
    const usage = {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    };
    expect(costOf("claude-opus-5-5", usage)).toBeCloseTo(6);
    expect(costOf("claude-sonnet-5-5", usage)).toBeCloseTo(3);
    expect(costOf("some-new-model", usage)).toBeCloseTo(15);
    expect(costOf("simulated", usage)).toBe(0);
  });
});
