import type { UniquenessRegistry } from "@brotasites/engine";
import { AnthropicModelClient, type Effort } from "./anthropic.js";
import type { AiCache } from "./cache.js";
import { AiDirector, type AiEvent } from "./director.js";
import {
  type BudgetAlert,
  defaultLimits,
  type LimitsConfig,
  SpendingGuard,
  type UsageStore,
} from "./limits.js";
import type { ModelClient } from "./model.js";
import { SimulatedModelClient } from "./simulated.js";

// The AI provider from the environment (.env.example). AI_MODE=simulated (the default) never
// calls an API; AI_MODE=live needs ANTHROPIC_API_KEY and AI_MODEL_ID. The model id always comes
// from the environment, never from the code.

export type Env = Record<string, string | undefined>;

const efforts: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

function number(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a positive number`);
  return value;
}

export function limitsFromEnv(env: Env): LimitsConfig {
  return {
    roundsPerSitePerDay: number(
      env,
      "AI_ROUNDS_PER_SITE_PER_DAY",
      defaultLimits.roundsPerSitePerDay,
    ),
    roundsPerAccountPerDay: number(
      env,
      "AI_ROUNDS_PER_ACCOUNT_PER_DAY",
      defaultLimits.roundsPerAccountPerDay,
    ),
    dailyBudgetUsd: number(env, "AI_DAILY_BUDGET_USD", defaultLimits.dailyBudgetUsd),
    alertRatio: number(env, "AI_BUDGET_ALERT_RATIO", defaultLimits.alertRatio),
  };
}

export function modelFromEnv(env: Env): ModelClient {
  const mode = env.AI_MODE || "simulated";
  if (mode === "simulated") return new SimulatedModelClient();
  if (mode !== "live") throw new Error('AI_MODE must be "simulated" or "live"');
  const modelId = env.AI_MODEL_ID;
  if (!modelId) throw new Error("AI_MODE=live needs AI_MODEL_ID");
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI_MODE=live needs ANTHROPIC_API_KEY");
  const effort = (env.AI_EFFORT || "medium") as Effort;
  if (!efforts.includes(effort)) throw new Error(`AI_EFFORT must be one of ${efforts.join(", ")}`);
  return new AnthropicModelClient({ modelId, apiKey: env.ANTHROPIC_API_KEY, effort });
}

export interface ProviderDeps {
  registry: UniquenessRegistry;
  usage: UsageStore;
  cache?: AiCache;
  onBudgetAlert?: BudgetAlert;
  onEvent?: (event: AiEvent) => void;
}

export function aiProviderFromEnv(env: Env, deps: ProviderDeps): AiDirector {
  return new AiDirector({
    model: modelFromEnv(env),
    registry: deps.registry,
    cache: deps.cache,
    guard: new SpendingGuard(deps.usage, limitsFromEnv(env), deps.onBudgetAlert),
    onEvent: deps.onEvent,
  });
}
