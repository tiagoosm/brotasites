import { aiProviderFromEnv } from "@brotasites/ai";
import type { R2Options } from "@brotasites/generator";
import { reviewerAgentFromEnv } from "@brotasites/reviewer";
import { createClient } from "@supabase/supabase-js";
import type { PipelineDeps } from "./pipeline.js";
import { LocalPreviewHost, type PreviewHost, R2PreviewHost, R2Publisher } from "./previews.js";
import { playwrightScreenshotter } from "./screenshots.js";
import { supabaseStore } from "./supabase-store.js";

// Everything the pipeline needs, from the environment (.env.example). Secrets only on the
// server: SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY, the R2 keys.

export type Env = Record<string, string | undefined>;

export function r2FromEnv(env: Env): R2Options | undefined {
  const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return undefined;
  return {
    accountId: CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET || "brotasites-sites",
  };
}

export function depsFromEnv(
  env: Env,
  options: { localPreviews?: string } = {},
): PipelineDeps & {
  close(): Promise<void>;
} {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  const store = supabaseStore(createClient(url, key, { auth: { persistSession: false } }));
  const r2 = r2FromEnv(env);
  let previews: PreviewHost;
  if (r2) previews = new R2PreviewHost(r2);
  else if (options.localPreviews) previews = new LocalPreviewHost(options.localPreviews);
  else throw new Error("Set the R2 variables, or run the local runner for local previews.");
  const screenshot = playwrightScreenshotter();
  return {
    store,
    ai: aiProviderFromEnv(env, {
      registry: store.registry,
      usage: store.usage,
      cache: store.cache,
      onBudgetAlert: (alert) =>
        console.warn(
          `AI budget alert: US$ ${alert.spentUsd.toFixed(2)} of US$ ${alert.budgetUsd} on ${alert.day}`,
        ),
    }),
    agent: reviewerAgentFromEnv(env),
    previews,
    publisher: r2 ? new R2Publisher(r2) : undefined,
    screenshot,
    skipHumanReview: env.REVIEW_SKIP_HUMAN === "true",
    log: (message) => console.log(message),
    close: () => screenshot.close(),
  };
}
