import { randomUUID } from "node:crypto";
import { MemoryCache, MemoryUsageStore } from "@brotasites/ai";
import { type CatalogWeights, MemoryRegistry, NO_WEIGHTS } from "@brotasites/engine";
import type {
  AssetRecord,
  DirectionRecord,
  Job,
  JobKind,
  PipelineStore,
  SitePatch,
  SitePurge,
  SiteRecord,
} from "./store.js";

// The store in memory: tests and local experiments without a database.

export class MemoryStore implements PipelineStore {
  readonly sites = new Map<
    string,
    SiteRecord & { statusMessage?: string | null; publishedAt?: Date }
  >();
  readonly jobs: (Job & { status: "queued" | "running" | "done" | "failed"; error?: string })[] =
    [];
  readonly events: { siteId: string; kind: string; message: string }[] = [];
  readonly directions: DirectionRecord[] = [];
  weights: CatalogWeights = NO_WEIGHTS;
  readonly assets = new Map<string, { record: AssetRecord; data: Uint8Array }>();
  readonly renders = new Map<string, Uint8Array>();
  readonly reports: { siteId: string; status: string; report: unknown }[] = [];
  readonly paid = new Set<string>();
  readonly purges: (SitePurge & { done: boolean; error?: string })[] = [];
  readonly registry = Object.assign(new MemoryRegistry(), {
    approved: new Set<string>(),
    async markApproved(this: { approved: Set<string> }, siteId: string) {
      this.approved.add(siteId);
    },
  });
  readonly usage = new MemoryUsageStore();
  readonly cache = new MemoryCache();

  async claimPurge() {
    const purge = this.purges.find((item) => !item.done && item.attempts < 5);
    if (!purge) return null;
    purge.attempts += 1;
    return {
      id: purge.id,
      siteId: purge.siteId,
      subdomain: purge.subdomain,
      attempts: purge.attempts,
    };
  }
  async finishPurge(id: number, error?: string) {
    const purge = this.purges.find((item) => item.id === id);
    if (purge) Object.assign(purge, error ? { error } : { done: true, error: undefined });
  }

  enqueue(siteId: string, kind: JobKind, payload: Record<string, unknown> = {}): Job {
    const job = { id: randomUUID(), siteId, kind, attempts: 0, payload, status: "queued" as const };
    this.jobs.push(job);
    return job;
  }

  async claimJob(kinds: JobKind[], jobId?: string) {
    const job = this.jobs.find(
      (item) =>
        item.status === "queued" && kinds.includes(item.kind) && (!jobId || item.id === jobId),
    );
    if (!job) return null;
    job.status = "running";
    job.attempts += 1;
    return { ...job };
  }
  async finishJob(jobId: string, status: "done" | "failed", error?: string) {
    const job = this.jobs.find((item) => item.id === jobId);
    if (job) Object.assign(job, { status, error });
  }
  async requeueJob(jobId: string, error: string) {
    const job = this.jobs.find((item) => item.id === jobId);
    if (job) Object.assign(job, { status: "queued", error });
  }

  async loadSite(siteId: string) {
    const site = this.sites.get(siteId);
    if (!site) throw new Error(`site ${siteId} not found`);
    return structuredClone(site);
  }
  async updateSite(siteId: string, patch: SitePatch) {
    const site = this.sites.get(siteId);
    if (!site) throw new Error(`site ${siteId} not found`);
    Object.assign(
      site,
      Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
    );
  }
  async addEvent(siteId: string, kind: string, message: string) {
    this.events.push({ siteId, kind, message });
  }
  async saveDirections(
    siteId: string,
    round: number,
    items: Omit<DirectionRecord, "id" | "siteId" | "round">[],
  ) {
    const saved = items.map((item) => ({ ...item, id: randomUUID(), siteId, round }));
    this.directions.push(...saved);
    return saved;
  }
  async catalogWeights() {
    return this.weights;
  }
  async getDirection(directionId: string) {
    return this.directions.find((item) => item.id === directionId) ?? null;
  }
  async listAssets(siteId: string) {
    return [...this.assets.values()]
      .filter((item) => item.record.storagePath.includes(siteId))
      .map((item) => item.record);
  }
  async downloadAsset(asset: AssetRecord) {
    const found = this.assets.get(asset.id);
    if (!found) throw new Error("missing asset");
    return found.data;
  }
  async uploadRender(path: string, data: Uint8Array) {
    this.renders.set(path, data);
  }
  async saveReport(siteId: string, status: string, report: unknown) {
    this.reports.push({ siteId, status, report });
  }
  async hasPaidPublish(siteId: string) {
    return this.paid.has(siteId);
  }
}
