import type { AiTask } from "./model.js";
import type { Usage } from "./prices.js";

// Spending guards (docs/ai-and-reviewer.md, AI security): AI rounds per site and per account
// per day, and a global daily budget with an alert. Past a limit the AI is not called and the
// engine works alone, so a client is never blocked; the cost of every round is recorded.
// In memory here; Supabase tables in E10 implement the same store.

export interface LimitsConfig {
  /** AI requests of one task per site per day (docs default: 20). */
  roundsPerSitePerDay: number;
  /** AI requests of one task per account per day, across its sites. */
  roundsPerAccountPerDay: number;
  /** Global spend per day, in USD. */
  dailyBudgetUsd: number;
  /** Share of the budget that triggers the alert (0.8 = at 80%). */
  alertRatio: number;
}

export const defaultLimits: LimitsConfig = {
  roundsPerSitePerDay: 20,
  roundsPerAccountPerDay: 40,
  dailyBudgetUsd: 20,
  alertRatio: 0.8,
};

/** What each model call is for, in the cost log (E24): "rewrite" is copy redone with notes. */
export type MeteredTask = "directions" | "copy" | "review" | "rewrite";

/** One model call, as the cost log keeps it: no prompt and no answer. */
export interface ModelCall {
  task: MeteredTask;
  model: string;
  usage: Usage;
  costUsd: number;
  siteId?: string;
  accountId?: string;
}

export interface UsageStore {
  /** Adds one round and returns the new count for that key. */
  countRound(key: string): Promise<number>;
  rounds(key: string): Promise<number>;
  /** Adds to the day's spend and returns the new total. */
  addSpend(day: string, usd: number): Promise<number>;
  spend(day: string): Promise<number>;
  /** True the first time it is called for a day (one alert per day). */
  claimAlert(day: string): Promise<boolean>;
  /** Keeps one model call in the cost log (Supabase: ai_calls). Optional: memory stores skip it. */
  logCall?(call: ModelCall): Promise<void>;
}

export class MemoryUsageStore implements UsageStore {
  private readonly counts = new Map<string, number>();
  private readonly spent = new Map<string, number>();
  private readonly alerted = new Set<string>();
  /** The cost log, kept for tests. */
  readonly calls: ModelCall[] = [];

  async logCall(call: ModelCall): Promise<void> {
    this.calls.push(call);
  }

  async countRound(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
  async rounds(key: string): Promise<number> {
    return this.counts.get(key) ?? 0;
  }
  async addSpend(day: string, usd: number): Promise<number> {
    const next = (this.spent.get(day) ?? 0) + usd;
    this.spent.set(day, next);
    return next;
  }
  async spend(day: string): Promise<number> {
    return this.spent.get(day) ?? 0;
  }
  async claimAlert(day: string): Promise<boolean> {
    if (this.alerted.has(day)) return false;
    this.alerted.add(day);
    return true;
  }
}

/** Why the AI was skipped; shown in the admin (pt-BR). */
export class LimitReached extends Error {}

export interface Caller {
  siteId: string;
  accountId: string;
}

export type BudgetAlert = (alert: { day: string; spentUsd: number; budgetUsd: number }) => void;

/** The day in Brazil (America/Sao_Paulo), as YYYY-MM-DD. */
export function dayOf(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

export class SpendingGuard {
  constructor(
    private readonly store: UsageStore,
    private readonly limits: LimitsConfig = defaultLimits,
    private readonly onAlert: BudgetAlert = () => {},
    private readonly now: () => Date = () => new Date(),
    /** The cost log is best effort: a failure is reported here and never stops the site. */
    private readonly onLogError: (error: unknown) => void = (error) =>
      console.warn(`AI cost log failed: ${error instanceof Error ? error.message : String(error)}`),
  ) {}

  private keys(task: AiTask, caller: Caller) {
    const day = dayOf(this.now());
    return {
      day,
      site: `${day}|site|${caller.siteId}|${task}`,
      account: `${day}|account|${caller.accountId}|${task}`,
    };
  }

  /** Throws LimitReached when this call would pass a limit; otherwise counts the round. */
  async admit(task: AiTask, caller: Caller): Promise<void> {
    const { day, site, account } = this.keys(task, caller);
    if ((await this.store.spend(day)) >= this.limits.dailyBudgetUsd) {
      throw new LimitReached("O orçamento diário de IA acabou; o motor trabalhou sozinho.");
    }
    if ((await this.store.rounds(site)) >= this.limits.roundsPerSitePerDay) {
      throw new LimitReached("Este site chegou ao limite de rodadas de IA de hoje.");
    }
    if ((await this.store.rounds(account)) >= this.limits.roundsPerAccountPerDay) {
      throw new LimitReached("Esta conta chegou ao limite de rodadas de IA de hoje.");
    }
    await this.store.countRound(site);
    await this.store.countRound(account);
  }

  /**
   * Records what a request cost and raises the alert once a day past the alert ratio. With the
   * call's details, it also goes to the cost log: the one place every model call is written.
   */
  async record(usd: number, call?: ModelCall): Promise<void> {
    const day = dayOf(this.now());
    if (call) await this.logCall(call);
    const total = await this.store.addSpend(day, usd);
    if (
      total >= this.limits.dailyBudgetUsd * this.limits.alertRatio &&
      (await this.store.claimAlert(day))
    ) {
      this.onAlert({ day, spentUsd: total, budgetUsd: this.limits.dailyBudgetUsd });
    }
  }

  /**
   * Writes one call to the cost log, never throwing: measuring must not break a site's
   * generation. Calls outside the budget (the reviewer's, which never counted in it) come here
   * directly.
   */
  async logCall(call: ModelCall): Promise<void> {
    try {
      await this.store.logCall?.(call);
    } catch (error) {
      this.onLogError(error);
    }
  }
}
