import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { PhotoAnswer } from "@brotasites/schema/v1.2";
import { MemoryStore } from "../memory-store.js";
import { JOB_KINDS, type PipelineDeps, runJob } from "../pipeline.js";
import type { PreviewHost } from "../previews.js";
import { briefOf, draftOf, type KitBusiness } from "./businesses.js";

// The generated half of the blind test: each business goes through the real pipeline (engine,
// AI copy, reviewer, generator) exactly as a client's answers would, with one of its three
// directions chosen in turn so the kit shows all of them. The sites land in
// <out>/generated/<slug>/, built under a placeholder base the assembly step replaces.

export const KIT_BASE = "__kit__";

export const kitBase = (slug: string) => `/${KIT_BASE}/${slug}/`;

export interface GeneratedSite {
  slug: string;
  name: string;
  direction: string | null;
  personality: string | null;
  status: string;
  modelId: string | null;
  photos: number;
  /** What the reviewer found when the site needs a person. */
  findings: string[];
}

export interface GenerateOptions {
  out: string;
  businesses: KitBusiness[];
  /** Everything but the store and the preview host, which the kit brings. */
  deps: (store: MemoryStore) => Omit<PipelineDeps, "store" | "previews">;
  /** Optional photos, one folder per business: <photosDir>/<slug>/*.jpg. */
  photosDir?: string;
  log?: (message: string) => void;
}

const photoTypes = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function altOf(file: string): string {
  const words = file
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function photosOf(store: MemoryStore, siteId: string, dir: string | undefined) {
  if (!dir || !existsSync(dir)) return { answers: [] as PhotoAnswer[], files: [] as string[] };
  const files = (await readdir(dir))
    .filter((file) => photoTypes.has(extname(file).toLowerCase()))
    .sort()
    .slice(0, 12);
  const answers: PhotoAnswer[] = [];
  for (const [index, file] of files.entries()) {
    const id = randomUUID();
    store.assets.set(id, {
      record: { id, bucket: "site-uploads", storagePath: `kit/${siteId}/${file}`, kind: "image" },
      data: await readFile(join(dir, file)),
    });
    answers.push({ assetId: id, alt: altOf(file), use: index === 0 ? "hero" : undefined });
  }
  return { answers, files };
}

async function runNext(deps: PipelineDeps, store: MemoryStore) {
  const job = await store.claimJob(JOB_KINDS);
  if (!job) throw new Error("No queued job");
  return runJob(deps, job);
}

export async function generateSites(options: GenerateOptions): Promise<GeneratedSite[]> {
  const log = options.log ?? (() => {});
  const store = new MemoryStore();
  const slugs = new Map<string, string>();
  const generatedDir = join(options.out, "generated");
  const previews: PreviewHost = {
    base: (siteId) => kitBase(slugs.get(siteId) ?? siteId),
    async upload(siteId, _token, distDir) {
      const target = join(generatedDir, slugs.get(siteId) ?? siteId);
      await rm(target, { recursive: true, force: true });
      await cp(distDir, target, { recursive: true });
    },
  };
  const deps: PipelineDeps = { ...options.deps(store), store, previews };
  await mkdir(join(options.out, "briefs"), { recursive: true });
  await mkdir(generatedDir, { recursive: true });

  const sites: GeneratedSite[] = [];
  for (const [index, business] of options.businesses.entries()) {
    const siteId = randomUUID();
    slugs.set(siteId, business.slug);
    const photos = await photosOf(
      store,
      siteId,
      options.photosDir && join(options.photosDir, business.slug),
    );
    store.sites.set(siteId, {
      id: siteId,
      ownerId: `kit-${index}`,
      status: "generating_directions",
      round: 0,
      subdomain: business.slug,
      approvedDirection: null,
      previewToken: null,
      draft: draftOf(business.facts, photos.answers),
      config: null,
    });
    await writeFile(
      join(options.out, "briefs", `${business.slug}.md`),
      briefOf(business, photos.files),
    );

    log(`${business.facts.name}: direções...`);
    store.enqueue(siteId, "directions");
    let outcome = await runNext(deps, store);
    const directions = store.directions.filter((d) => d.siteId === siteId);
    // The client's choice: each direction in turn, so the kit has all three.
    const chosen = directions[index % Math.max(directions.length, 1)];
    if (outcome === "done" && chosen) {
      log(`${business.facts.name}: montando a direção ${chosen.direction}...`);
      const record = store.sites.get(siteId);
      if (record) Object.assign(record, { status: "building", approvedDirection: chosen.id });
      store.enqueue(siteId, "build");
      outcome = await runNext(deps, store);
    }
    const site = await store.loadSite(siteId);
    const config = site.config as { ai?: { modelId?: string | null } } | null;
    const report = store.reports.findLast((item) => item.siteId === siteId)?.report as
      | { reason?: string; findings?: { check: string; where?: string; message: string }[] }
      | undefined;
    const findings = [
      ...(report?.reason ? [report.reason] : []),
      ...(report?.findings ?? []).map(
        (f) => `${f.check}${f.where ? `@${f.where}` : ""}: ${f.message}`,
      ),
    ];
    sites.push({
      slug: business.slug,
      name: business.facts.name,
      direction: chosen?.direction ?? null,
      personality: chosen?.identity.personality ?? null,
      status: site.status,
      modelId: config?.ai?.modelId ?? null,
      photos: photos.answers.length,
      findings: isFinishedStatus(site.status) ? [] : findings,
    });
    log(`${business.facts.name}: ${site.status}`);
    if (!isFinishedStatus(site.status)) for (const finding of findings) log(`  ${finding}`);
  }
  await writeFile(join(generatedDir, "manifest.json"), `${JSON.stringify(sites, null, 2)}\n`);
  return sites;
}

/** A site the pipeline finished (waiting for the human review in the product). */
const isFinishedStatus = (status: string) =>
  status === "in_review" || status === "awaiting_approval";

export const isFinished = (site: GeneratedSite) => isFinishedStatus(site.status);
