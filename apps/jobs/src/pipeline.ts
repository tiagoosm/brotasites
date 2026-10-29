import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { AiDirector } from "@brotasites/ai";
import {
  applyOverrides,
  choicesOfIdentity,
  compositionKey,
  type EngineInput,
} from "@brotasites/engine";
import { buildStaticSite } from "@brotasites/generator";
import { type BrowserResult, type ReviewerAgent, reviewSite } from "@brotasites/reviewer";
import {
  familyOf,
  formToSiteConfig,
  type SiteConfig,
  sectionsOf,
  siteConfigSchema,
} from "@brotasites/schema/v1.2";
import type { PreviewHost, Publisher } from "./previews.js";
import type { Purger } from "./purge.js";
import type { Screenshotter } from "./screenshots.js";
import type { Job, JobKind, PipelineStore, SiteRecord } from "./store.js";
import { prepareWorkspace, type Workspace } from "./workspace.js";

// The generation pipeline (docs/product.md, Site status):
//   directions: photos cleaned, the AI art director (or the engine) draws the 3 directions,
//               each is built and photographed for its card -> awaiting_direction_choice;
//   build:      the chosen direction locks, the AI rewrites the text, the reviewer checks and
//               fixes, the finished site goes to a private preview -> in_review (a person
//               looks first) or needs_attention;
//   publish:    after a confirmed payment, the site goes live on R2 -> live.
// A failed job is retried once; then the site goes to needs_attention and the admin queue.

export interface PipelineDeps {
  store: PipelineStore;
  ai: AiDirector;
  agent: ReviewerAgent;
  previews: PreviewHost;
  /** Without it (no R2 yet), paid sites wait in "publishing". */
  publisher?: Publisher;
  screenshot: Screenshotter;
  /** The reviewer's browser checks; its own Chromium by default. */
  browserChecks?: (site: { distDir: string; base?: string }) => Promise<BrowserResult>;
  build?: typeof buildStaticSite;
  /** Removes a deleted site's files from R2 and KV (E15); without R2 the cleanups wait. */
  purger?: Purger;
  /** Development only: skip the human review and go straight to the client. */
  skipHumanReview?: boolean;
  log?: (message: string) => void;
}

export const JOB_KINDS: JobKind[] = ["directions", "build", "publish"];

const ATTENTION_MESSAGE =
  "Encontramos um problema que precisa de uma pessoa. Nossa equipe já foi avisada e responde por aqui.";

export class JobError extends Error {}

function engineInputOf(site: SiteRecord, workspace: Workspace): EngineInput {
  const business = site.draft.business ?? {};
  const family = familyOf(business.category);
  if (!family || !business.name || !business.city || !business.category) {
    throw new JobError("Respostas incompletas: falta nome, tipo de negócio ou cidade.");
  }
  const photos = [...workspace.assets].filter((id) => id !== site.draft.brand?.logoAsset);
  return {
    name: business.name,
    city: business.city,
    category: business.category,
    family,
    feelings: site.draft.brand?.feelings ?? [],
    brandColors: site.draft.brand?.brandColors ?? [],
    hasLogo: Boolean(
      site.draft.brand?.logoAsset && workspace.assets.has(site.draft.brand.logoAsset),
    ),
    photos: photos.length === 0 ? "none" : workspace.strongPhoto ? "good" : "weak",
    sections: ["hero", ...sectionsOf(site.draft)],
    round: site.round,
  };
}

async function build(
  deps: PipelineDeps,
  workspace: Workspace,
  config: object,
  outName: string,
  base = "/",
) {
  const configPath = await workspace.writeConfig(config);
  const outDir = join(workspace.dir, outName);
  const result = await (deps.build ?? buildStaticSite)(configPath, outDir, base);
  if (!result.ok) throw new JobError(`O build falhou:\n${result.log.slice(-2000)}`);
  return outDir;
}

export async function runDirections(deps: PipelineDeps, job: Job): Promise<void> {
  const { store } = deps;
  const site = await store.loadSite(job.siteId);
  if (site.status !== "generating_directions") return;
  const workspace = await prepareWorkspace(store, site.id);
  try {
    for (const warning of workspace.warnings)
      await store.addEvent(site.id, "photo_warning", warning);
    const input = engineInputOf(site, workspace);
    const result = await deps.ai.generateDirections({
      siteId: site.id,
      accountId: site.ownerId,
      input,
      weights: await store.catalogWeights(),
    });

    const saved = [];
    for (const direction of result.directions) {
      const config = formToSiteConfig(site.draft, {
        identity: direction.identity,
        availableAssets: workspace.assets,
        round: site.round,
        seed: result.seed,
      });
      const outDir = await build(deps, workspace, config, `direction-${direction.id}`);
      const screenshots: string[] = [];
      for (const shot of await deps.screenshot(outDir)) {
        const path = `${site.id}/${site.round}/${direction.id}-${shot.width}.png`;
        await store.uploadRender(path, shot.png, "image/png");
        screenshots.push(path);
      }
      saved.push({
        direction: direction.id,
        identity: direction.identity,
        features: direction.features,
        source: result.source,
        screenshots,
        compositionKey: compositionKey(choicesOfIdentity(direction.identity)),
      });
    }
    await store.saveDirections(site.id, site.round, saved);
    // The site's first direction stands for it in the registry until the client chooses.
    const first = result.directions[0];
    if (first) await deps.ai.recordApproved(site.id, input.family, input.city, first);
    await store.updateSite(site.id, { status: "awaiting_direction_choice", statusMessage: null });
    await store.addEvent(
      site.id,
      "directions_ready",
      "As 3 direções estão prontas. Escolha a sua em Meus sites.",
    );
  } finally {
    await workspace.dispose();
  }
}

export async function runBuild(deps: PipelineDeps, job: Job): Promise<void> {
  const { store } = deps;
  const site = await store.loadSite(job.siteId);
  if (site.status !== "building") return;
  const direction = site.approvedDirection
    ? await store.getDirection(site.approvedDirection)
    : null;
  if (!direction) throw new JobError("A direção escolhida não foi encontrada.");
  const workspace = await prepareWorkspace(store, site.id);
  try {
    for (const warning of workspace.warnings)
      await store.addEvent(site.id, "photo_warning", warning);
    const caller = { siteId: site.id, accountId: site.ownerId };
    const answers = siteConfigSchema.parse(
      formToSiteConfig(
        { ...site.draft, site: { subdomain: site.subdomain ?? site.draft.site?.subdomain } },
        {
          identity: direction.identity,
          approvedDirectionId: direction.direction,
          availableAssets: workspace.assets,
          round: direction.round,
          seed: `${site.id}|${direction.round}`,
        },
      ),
    );
    // Colors changed after approval: kept with AA contrast, the identity itself stays locked.
    const colors = site.draft.colorOverrides;
    const form =
      colors && Object.keys(colors).length > 0
        ? { ...answers, design: applyOverrides(answers.design, { colors }, { repair: true }) }
        : answers;
    const input = engineInputOf(site, workspace);
    await deps.ai.recordApproved(site.id, input.family, input.city, {
      id: direction.direction,
      label: direction.direction,
      seed: form.design.seed,
      identity: direction.identity,
      features: direction.features,
    });
    await store.registry.markApproved(site.id);

    // A person's change request (admin queue) reaches the copy step as notes.
    const adminNotes = Array.isArray(job.payload.adminNotes)
      ? job.payload.adminNotes.filter((note): note is string => typeof note === "string")
      : [];
    const copy = await deps.ai.writeCopy(form, caller, { notes: adminNotes });
    let reviewBuilds = 0;
    const report = await reviewSite({
      config: copy.config,
      form,
      agent: deps.agent,
      browser: deps.browserChecks,
      build: async (config) => ({
        distDir: await build(deps, workspace, config, `review-${reviewBuilds++}`),
      }),
      rewriteCopy: async (config, findings) =>
        (
          await deps.ai.writeCopy(config, caller, {
            notes: findings.map((finding) => finding.message),
          })
        ).config,
    });
    await store.saveReport(site.id, report.status, {
      reason: report.reason,
      rounds: report.rounds,
      findings: report.findings,
      costUsd: report.costUsd + copy.costUsd,
      copySource: copy.source,
    });

    if (report.status === "needsAttention") {
      await store.updateSite(site.id, {
        status: "needs_attention",
        statusMessage: ATTENTION_MESSAGE,
        config: report.config,
      });
      await store.addEvent(
        site.id,
        "review_needs_attention",
        "A revisão encontrou algo que precisa de uma pessoa.",
      );
      return;
    }

    const token = site.previewToken ?? randomBytes(24).toString("base64url");
    const outDir = await build(
      deps,
      workspace,
      report.config,
      "preview",
      deps.previews.base(site.id, token),
    );
    await deps.previews.upload(site.id, token, outDir);
    const next = deps.skipHumanReview ? "awaiting_approval" : "in_review";
    await store.updateSite(site.id, {
      status: next,
      statusMessage: null,
      previewToken: token,
      config: report.config,
    });
    await store.addEvent(
      site.id,
      "site_built",
      next === "in_review"
        ? "Seu site está montado. Estamos dando uma última olhada antes de mostrar para você."
        : "Seu site está pronto para você conferir.",
    );
  } finally {
    await workspace.dispose();
  }
}

export async function runPublish(deps: PipelineDeps, job: Job): Promise<void> {
  const { store } = deps;
  const site = await store.loadSite(job.siteId);
  if (site.status !== "publishing") return;
  if (!(await store.hasPaidPublish(site.id))) {
    throw new JobError("Publicação sem pagamento confirmado.");
  }
  if (!site.config || !site.subdomain)
    throw new JobError("O site ainda não foi montado ou não tem endereço.");
  if (!deps.publisher) {
    await store.updateSite(site.id, {
      statusMessage: "Pagamento confirmado. O site entra no ar assim que a hospedagem for ligada.",
    });
    return;
  }
  const workspace = await prepareWorkspace(store, site.id);
  try {
    const config: SiteConfig = {
      ...site.config,
      site: { ...site.config.site, subdomain: site.subdomain },
    };
    const outDir = await build(deps, workspace, config, "live");
    await deps.publisher.deploy(site.subdomain, outDir);
    await store.updateSite(site.id, {
      status: "live",
      statusMessage: null,
      publishedAt: new Date(),
    });
    await store.addEvent(site.id, "published", "Seu site está no ar.");
  } finally {
    await workspace.dispose();
  }
}

/** Runs one job; retries once, then sends the site to needs_attention. */
export async function runJob(deps: PipelineDeps, job: Job): Promise<"done" | "retry" | "failed"> {
  const { store } = deps;
  try {
    if (job.kind === "directions") await runDirections(deps, job);
    else if (job.kind === "build") await runBuild(deps, job);
    else await runPublish(deps, job);
    await store.finishJob(job.id, "done");
    return "done";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.log?.(`Job ${job.id} (${job.kind}) failed on attempt ${job.attempts}: ${message}`);
    if (job.attempts < 2) {
      await store.requeueJob(job.id, message);
      return "retry";
    }
    await store.finishJob(job.id, "failed", message);
    await store.updateSite(job.siteId, {
      status: "needs_attention",
      statusMessage: ATTENTION_MESSAGE,
    });
    await store.addEvent(
      job.siteId,
      "job_failed",
      "Algo deu errado do nosso lado. Nossa equipe já foi avisada.",
    );
    return "failed";
  }
}
