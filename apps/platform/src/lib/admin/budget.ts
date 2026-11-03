import { limits } from "@/config/limits";

// The AI's daily budget, as the jobs read it (packages/ai/src/config.ts, limitsFromEnv): the
// same environment variables, with the same defaults (packages/ai/src/limits.ts, defaultLimits).
// The panel only shows it; changing it is the owner's, in the environment.

const DEFAULT_DAILY_BUDGET_USD = 20;
const DEFAULT_ALERT_RATIO = 0.8;

function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function aiBudget(env: Record<string, string | undefined> = process.env) {
  return {
    dailyBudgetUsd: number(env.AI_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD),
    alertRatio: number(env.AI_BUDGET_ALERT_RATIO, DEFAULT_ALERT_RATIO),
    roundsPerSitePerDay: number(env.AI_ROUNDS_PER_SITE_PER_DAY, 20),
    roundsPerAccountPerDay: number(env.AI_ROUNDS_PER_ACCOUNT_PER_DAY, 40),
    usdToBrl: limits.usdToBrl.rate,
  };
}

export type AiBudget = ReturnType<typeof aiBudget>;

/** Where today's spend stands against the budget: under, past the alert, or over. */
export function budgetLevel(
  spentUsd: number,
  budget: Pick<AiBudget, "dailyBudgetUsd" | "alertRatio">,
) {
  const ratio = budget.dailyBudgetUsd > 0 ? spentUsd / budget.dailyBudgetUsd : 0;
  return {
    ratio,
    level: ratio >= 1 ? "over" : ratio >= budget.alertRatio ? "alert" : "ok",
  } as const;
}
