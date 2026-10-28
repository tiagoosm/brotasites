import type { AiCache, UsageStore } from "@brotasites/ai";
import { type DesignSignature, normalizeText } from "@brotasites/engine";
import type { Family, FormDraft, SiteConfig } from "@brotasites/schema/v1.2";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetRecord,
  DirectionRecord,
  Job,
  JobKind,
  PipelineStore,
  SitePatch,
  SiteRecord,
} from "./store.js";

// The store on Supabase, with the secret key (server only; RLS does not apply to it). Tables and
// functions: supabase/migrations/20261028000000_platform_v12.sql.

function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

const toJob = (row: Record<string, unknown>): Job => ({
  id: row.id as string,
  siteId: row.site_id as string,
  kind: row.kind as JobKind,
  attempts: row.attempts as number,
  payload: (row.payload as Record<string, unknown>) ?? {},
});

const toDirection = (row: Record<string, unknown>): DirectionRecord => ({
  id: row.id as string,
  siteId: row.site_id as string,
  round: row.round as number,
  direction: row.direction as DirectionRecord["direction"],
  identity: row.identity as DirectionRecord["identity"],
  features: row.features as DirectionRecord["features"],
  source: row.source as DirectionRecord["source"],
  screenshots: (row.screenshots as string[]) ?? [],
});

export function supabaseStore(db: SupabaseClient): PipelineStore {
  const registry = {
    async near(family: Family, city: string, exceptSiteId?: string): Promise<DesignSignature[]> {
      let query = db
        .from("design_registry")
        .select("*")
        .eq("family", family)
        .eq("city_key", normalizeText(city));
      if (exceptSiteId) query = query.neq("site_id", exceptSiteId);
      const rows = check(await query, "registry") as Record<string, unknown>[];
      return rows.map((row) => ({
        siteId: row.site_id as string,
        family: row.family as Family,
        city: row.city_key as string,
        fingerprint: row.fingerprint as string,
        features: row.features as DesignSignature["features"],
      }));
    },
    async record(signature: DesignSignature) {
      check(
        await db.from("design_registry").upsert({
          site_id: signature.siteId,
          family: signature.family,
          city_key: normalizeText(signature.city),
          fingerprint: signature.fingerprint,
          features: signature.features,
          updated_at: new Date().toISOString(),
        }),
        "registry record",
      );
    },
    async remove(siteId: string) {
      check(await db.from("design_registry").delete().eq("site_id", siteId), "registry remove");
    },
    async markApproved(siteId: string) {
      check(
        await db.from("design_registry").update({ approved: true }).eq("site_id", siteId),
        "registry approve",
      );
    },
  };

  const usage: UsageStore = {
    async countRound(key) {
      return check(await db.rpc("ai_count_round", { p_key: key }), "AI rounds") as number;
    },
    async rounds(key) {
      const rows = check(await db.from("ai_usage").select("count").eq("key", key), "AI rounds") as {
        count: number;
      }[];
      return rows[0]?.count ?? 0;
    },
    async addSpend(day, usd) {
      return Number(check(await db.rpc("ai_add_spend", { p_day: day, p_usd: usd }), "AI spend"));
    },
    async spend(day) {
      const rows = check(await db.from("ai_spend").select("usd").eq("day", day), "AI spend") as {
        usd: number;
      }[];
      return Number(rows[0]?.usd ?? 0);
    },
    async claimAlert(day) {
      return check(await db.rpc("ai_claim_alert", { p_day: day }), "AI alert") === true;
    },
  };

  const cache: AiCache = {
    async get(key) {
      const rows = check(await db.from("ai_cache").select("value").eq("key", key), "AI cache") as {
        value: unknown;
      }[];
      return rows[0]?.value;
    },
    async set(key, value) {
      check(await db.from("ai_cache").upsert({ key, value }), "AI cache");
    },
  };

  return {
    registry,
    usage,
    cache,

    async claimJob(kinds, jobId) {
      const rows = check(
        await db.rpc("claim_job", { p_kinds: kinds, p_job_id: jobId ?? null }),
        "claim job",
      ) as Record<string, unknown>[];
      return rows[0] ? toJob(rows[0]) : null;
    },
    async finishJob(jobId, status, error) {
      check(
        await db
          .from("jobs")
          .update({
            status,
            error: error?.slice(0, 2000) ?? null,
            finished_at: new Date().toISOString(),
          })
          .eq("id", jobId),
        "finish job",
      );
    },
    async requeueJob(jobId, error) {
      check(
        await db
          .from("jobs")
          .update({ status: "queued", error: error.slice(0, 2000) })
          .eq("id", jobId),
        "requeue job",
      );
    },

    async loadSite(siteId) {
      const site = check(
        await db.from("sites").select("*").eq("id", siteId).single(),
        "site",
      ) as Record<string, unknown>;
      const config = check(
        await db.from("site_configs").select("draft, config").eq("site_id", siteId).maybeSingle(),
        "site config",
      ) as { draft: FormDraft; config: SiteConfig | null } | null;
      return {
        id: site.id as string,
        ownerId: site.owner_id as string,
        status: site.status as SiteRecord["status"],
        round: site.round as number,
        subdomain: (site.subdomain as string | null) ?? null,
        approvedDirection: (site.approved_direction as string | null) ?? null,
        previewToken: (site.preview_token as string | null) ?? null,
        draft: config?.draft ?? {},
        config: config?.config ?? null,
      };
    },
    async updateSite(siteId, patch: SitePatch) {
      const row: Record<string, unknown> = {};
      if (patch.status) row.status = patch.status;
      if (patch.statusMessage !== undefined) row.status_message = patch.statusMessage;
      if (patch.previewToken) row.preview_token = patch.previewToken;
      if (patch.publishedAt) row.published_at = patch.publishedAt.toISOString();
      if (Object.keys(row).length > 0)
        check(await db.from("sites").update(row).eq("id", siteId), "update site");
      if (patch.config) {
        check(
          await db.from("site_configs").update({ config: patch.config }).eq("site_id", siteId),
          "update config",
        );
      }
    },
    async addEvent(siteId, kind, message) {
      check(
        await db
          .from("site_events")
          .insert({ site_id: siteId, kind, message: message.slice(0, 300) }),
        "event",
      );
    },

    async saveDirections(siteId, round, directions) {
      const rows = check(
        await db
          .from("site_directions")
          .upsert(
            directions.map((item) => ({
              site_id: siteId,
              round,
              direction: item.direction,
              identity: item.identity,
              features: item.features,
              source: item.source,
              screenshots: item.screenshots,
            })),
            { onConflict: "site_id,round,direction" },
          )
          .select("*"),
        "save directions",
      ) as Record<string, unknown>[];
      return rows.map(toDirection);
    },
    async getDirection(directionId) {
      const rows = check(
        await db.from("site_directions").select("*").eq("id", directionId),
        "direction",
      ) as Record<string, unknown>[];
      return rows[0] ? toDirection(rows[0]) : null;
    },

    async listAssets(siteId) {
      const rows = check(
        await db.from("assets").select("id, bucket, storage_path, kind").eq("site_id", siteId),
        "assets",
      ) as Record<string, unknown>[];
      return rows.map(
        (row): AssetRecord => ({
          id: row.id as string,
          bucket: row.bucket as string,
          storagePath: row.storage_path as string,
          kind: row.kind as AssetRecord["kind"],
        }),
      );
    },
    async downloadAsset(asset) {
      const { data, error } = await db.storage.from(asset.bucket).download(asset.storagePath);
      if (error || !data)
        throw new Error(`download ${asset.storagePath}: ${error?.message ?? "empty"}`);
      return new Uint8Array(await data.arrayBuffer());
    },
    async uploadRender(path, data, contentType) {
      const { error } = await db.storage
        .from("site-renders")
        .upload(path, data, { contentType, upsert: true });
      if (error) throw new Error(`upload render ${path}: ${error.message}`);
    },

    async saveReport(siteId, status, report) {
      check(
        await db.from("review_reports").insert({ site_id: siteId, status, report }),
        "review report",
      );
    },
    async hasPaidPublish(siteId) {
      const rows = check(
        await db
          .from("payments")
          .select("id")
          .eq("site_id", siteId)
          .eq("purpose", "publish")
          .eq("status", "paid"),
        "payments",
      ) as unknown[];
      return rows.length > 0;
    },
  };
}
