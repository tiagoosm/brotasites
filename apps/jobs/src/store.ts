import type { AiCache, UsageStore } from "@brotasites/ai";
import type {
  CatalogWeights,
  DesignFeatures,
  DirectionId,
  UniquenessRegistry,
} from "@brotasites/engine";
import type { FormDraft, Identity, SiteConfig } from "@brotasites/schema/v1.2";

// What the jobs need from the database, behind an interface so the pipeline runs the same on
// Supabase (supabase-store.ts) and in memory (tests). Statuses follow docs/product.md.

export type SiteStatus =
  | "draft"
  | "generating_directions"
  | "awaiting_direction_choice"
  | "building"
  | "in_review"
  | "awaiting_approval"
  | "publishing"
  | "live"
  | "needs_attention"
  | "suspended"
  | "grace";

export type JobKind = "directions" | "build" | "publish";

export interface Job {
  id: string;
  siteId: string;
  kind: JobKind;
  /** How many times the job was started, this run included. */
  attempts: number;
  payload: Record<string, unknown>;
}

export interface SiteRecord {
  id: string;
  ownerId: string;
  status: SiteStatus;
  round: number;
  subdomain: string | null;
  approvedDirection: string | null;
  previewToken: string | null;
  draft: FormDraft;
  /** The config the site was last built with. */
  config: SiteConfig | null;
}

export interface DirectionRecord {
  id: string;
  siteId: string;
  round: number;
  direction: DirectionId;
  identity: Identity;
  features: DesignFeatures;
  source: "ai" | "engine";
  screenshots: string[];
  /** The composition's key, for the admin's metrics per composition. */
  compositionKey?: string;
}

export interface AssetRecord {
  id: string;
  bucket: string;
  storagePath: string;
  kind: "logo" | "image";
}

export interface SitePatch {
  status?: SiteStatus;
  statusMessage?: string | null;
  previewToken?: string;
  config?: SiteConfig;
  publishedAt?: Date;
}

/** What a deleted site left in hosting (site_purges, E15). */
export interface SitePurge {
  id: number;
  siteId: string;
  subdomain: string | null;
  attempts: number;
}

export interface PipelineStore {
  /** Takes the oldest queued job of these kinds (or the given one) and marks it running. */
  claimJob(kinds: JobKind[], jobId?: string): Promise<Job | null>;
  finishJob(jobId: string, status: "done" | "failed", error?: string): Promise<void>;
  /** Puts a failed job back in the queue for its one automatic retry. */
  requeueJob(jobId: string, error: string): Promise<void>;

  loadSite(siteId: string): Promise<SiteRecord>;
  updateSite(siteId: string, patch: SitePatch): Promise<void>;
  /** A timeline entry the client sees (pt-BR). */
  addEvent(siteId: string, kind: string, message: string): Promise<void>;

  saveDirections(
    siteId: string,
    round: number,
    directions: Omit<DirectionRecord, "id" | "siteId" | "round">[],
  ): Promise<DirectionRecord[]>;
  getDirection(directionId: string): Promise<DirectionRecord | null>;

  listAssets(siteId: string): Promise<AssetRecord[]>;
  downloadAsset(asset: AssetRecord): Promise<Uint8Array>;
  /** Writes a render (direction screenshot) to the private renders bucket. */
  uploadRender(path: string, data: Uint8Array, contentType: string): Promise<void>;

  saveReport(siteId: string, status: string, report: unknown): Promise<void>;
  /** True when the site has a confirmed payment to publish. */
  hasPaidPublish(siteId: string): Promise<boolean>;
  /** The admin's recommended and retired compositions and variants (E11). */
  catalogWeights(): Promise<CatalogWeights>;

  /** Takes the oldest pending hosting cleanup of a deleted site (at most 5 attempts). */
  claimPurge(): Promise<SitePurge | null>;
  finishPurge(id: number, error?: string): Promise<void>;

  registry: UniquenessRegistry & { markApproved(siteId: string): Promise<void> };
  usage: UsageStore;
  cache: AiCache;
}
