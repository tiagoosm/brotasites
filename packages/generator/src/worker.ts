import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFinalConfig, type SiteConfig, type SiteDraft } from "@brotasites/schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type GenerateOptions, type GenerateResult, generateSite } from "./generate.js";

// The generation worker. The platform queues a job when the client publishes
// (request_publication); the worker takes it, turns the draft into the final config (the
// Zod schema has the last word, whatever the browser sent), builds the static site and
// hands it to `deploy`. Without a deploy step the site waits in "publishing".

export interface Job {
  id: string;
  site_id: string;
  kind: "generate" | "publish";
}

export type JobOutcome =
  | { ok: true; config: SiteConfig; live: boolean }
  | { ok: false; error: string };

/** Where jobs and sites are stored (Supabase in production, memory in tests). */
export interface JobStore {
  claimNextJob(): Promise<Job | null>;
  loadSite(siteId: string): Promise<{ subdomain: string | null; draft: SiteDraft } | null>;
  finishJob(job: Job, outcome: JobOutcome): Promise<void>;
}

export interface WorkerOptions {
  generate?: (options: GenerateOptions) => Promise<GenerateResult>;
  /** Publishes the built site. Leave out until deployment is set up. */
  deploy?: (outDir: string, config: SiteConfig) => Promise<void>;
  /** Hosts uploaded photos may be downloaded from. */
  allowedImageHosts?: string[];
}

/** Processes one queued job. Returns false when there was nothing to do. */
export async function processNextJob(
  store: JobStore,
  options: WorkerOptions = {},
): Promise<boolean> {
  const job = await store.claimNextJob();
  if (!job) return false;
  await store.finishJob(job, await runJob(store, job, options));
  return true;
}

async function runJob(store: JobStore, job: Job, options: WorkerOptions): Promise<JobOutcome> {
  const site = await store.loadSite(job.site_id);
  if (!site?.subdomain) return { ok: false, error: "Site ou endereço não encontrado." };

  // The address reserved in the database wins over whatever the draft says.
  const final = buildFinalConfig({
    ...site.draft,
    site: { ...site.draft.site, subdomain: site.subdomain },
  });
  if (!final.ok) return { ok: false, error: final.problems.map((p) => p.message).join(" ") };

  const workDir = await mkdtemp(join(tmpdir(), "brotasites-job-"));
  try {
    const configPath = join(workDir, "site-config.json");
    await writeFile(configPath, JSON.stringify(final.config, null, 2));
    const outDir = join(workDir, "site");
    const generate = options.generate ?? generateSite;
    const result = await generate({ configPath, outDir, allowedHosts: options.allowedImageHosts });
    if (!result.success) return { ok: false, error: result.errors.join("\n") };
    if (options.deploy) await options.deploy(outDir, final.config);
    return { ok: true, config: final.config, live: Boolean(options.deploy) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** The job store on Supabase. Needs the secret key: it writes what clients may not. */
export function supabaseJobStore(supabase: SupabaseClient): JobStore {
  return {
    async claimNextJob() {
      const { data, error } = await supabase.rpc("claim_next_job");
      if (error) throw error;
      const rows = (data ?? []) as Job[];
      return rows[0] ?? null;
    },
    async loadSite(siteId) {
      const { data, error } = await supabase
        .from("sites")
        .select("subdomain, site_configs(draft)")
        .eq("id", siteId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const configs = data.site_configs as { draft: SiteDraft } | { draft: SiteDraft }[] | null;
      const config = Array.isArray(configs) ? configs[0] : configs;
      return { subdomain: data.subdomain as string | null, draft: config?.draft ?? {} };
    },
    async finishJob(job, outcome) {
      const finished = new Date().toISOString();
      if (outcome.ok) {
        await check(
          supabase
            .from("site_configs")
            .update({ config: outcome.config })
            .eq("site_id", job.site_id),
        );
      }
      await check(
        supabase
          .from("jobs")
          .update({
            status: outcome.ok ? "done" : "failed",
            error: outcome.ok ? null : outcome.error,
            finished_at: finished,
          })
          .eq("id", job.id),
      );
      const status = outcome.ok ? (outcome.live ? "live" : "publishing") : "failed";
      await check(supabase.from("sites").update({ status }).eq("id", job.site_id));
    },
  };
}

async function check(query: PromiseLike<{ error: unknown }>) {
  const { error } = await query;
  if (error) throw error;
}
