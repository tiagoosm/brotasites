// Whether site generation is set up (E34). Generating a site needs the queue (Trigger.dev), the
// hosting the jobs publish to (Cloudflare R2 and KV, the same account the platform suspends sites
// in) and the addresses of the previews and the sites. Without them, a site would wait in
// "Criando as 3 direções" forever (the "Real Dente" site did): in production, creating a site
// and asking for directions are refused instead, and the team's overview lists what is missing.
//
// Only the presence of each variable is checked, never its value, and only names ever leave
// this file. The AI key and model, and the R2 keys, are read by the jobs on Trigger.dev, not by
// the platform: `pnpm check:launch --target trigger` checks those (docs/launch-status.md).
//
// In development and tests nothing is refused: jobs wait for the local runner (pnpm --filter
// @brotasites/jobs dev:local) with the simulated AI, as before. BROTASITES_STRICT_GENERATION=1
// turns the production rule on outside Vercel (the e2e tests).

/** What the platform needs, on Vercel, to start and follow a generation. */
export const GENERATION_VARIABLES = [
  "TRIGGER_SECRET_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_KV_NAMESPACE_ID",
  "CLOUDFLARE_KV_API_TOKEN",
  "NEXT_PUBLIC_BASE_DOMAIN",
  "NEXT_PUBLIC_PREVIEW_ORIGIN",
] as const;

/** A queued job older than this is shown as stuck (lib/stuck-job.ts). */
export { STUCK_JOB_MINUTES } from "@/lib/stuck-job";

export interface GenerationStatus {
  /** Whether the rule applies here (production, or the strict flag). */
  enforced: boolean;
  /** Names of the variables that are missing or empty, in GENERATION_VARIABLES order. */
  missing: string[];
  /** Creating a site and asking for directions are allowed. */
  ready: boolean;
}

type Env = Record<string, string | undefined>;

export function generationStatus(env: Env = process.env): GenerationStatus {
  const enforced = env.VERCEL_ENV === "production" || env.BROTASITES_STRICT_GENERATION === "1";
  const missing = GENERATION_VARIABLES.filter((name) => !env[name]?.trim());
  return { enforced, missing, ready: !enforced || missing.length === 0 };
}

/** Shortcut: true when a new generation may start here. */
export function generationReady(env: Env = process.env): boolean {
  return generationStatus(env).ready;
}

/** Said to the person when generation is not open yet (the create page and the API). */
export const generationClosed = {
  title: "Estamos preparando a criação de sites",
  text: "Estamos preparando a criação de sites. Avisaremos você por e-mail quando abrir.",
  code: "generation_not_ready",
} as const;
