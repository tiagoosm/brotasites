import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteHostingKey, setHostingState } from "./hosting";
import { triggerPurge } from "./jobs";

// Deleting an account (E15, /conta): the database removes the sites and keeps paid charges
// (server_delete_account), then the files go from Storage, the published sites go offline in
// KV at once, the jobs remove their files from R2 (site_purges) and the auth user goes last.

const BUCKETS_BY_OWNER = ["site-uploads", "site-images"] as const;
const RENDERS = "site-renders";

export interface DeletionDeps {
  db: SupabaseClient;
  setState?: typeof setHostingState;
  deleteKey?: typeof deleteHostingKey;
  purge?: typeof triggerPurge;
}

export interface DeletionResult {
  sites: number;
  retainedPayments: number;
  files: number;
  offline: string[];
}

/** Every file under a folder (Storage lists one level at a time). */
async function filesUnder(
  db: SupabaseClient,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 4) return [];
  const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    // Folders have no id.
    if (entry.id) paths.push(path);
    else paths.push(...(await filesUnder(db, bucket, path, depth + 1)));
  }
  return paths;
}

async function removeFolder(db: SupabaseClient, bucket: string, prefix: string): Promise<number> {
  const paths = await filesUnder(db, bucket, prefix);
  for (let i = 0; i < paths.length; i += 100) {
    await db.storage.from(bucket).remove(paths.slice(i, i + 100));
  }
  return paths.length;
}

export class DeletionError extends Error {}

export async function deleteAccount(userId: string, deps: DeletionDeps): Promise<DeletionResult> {
  const { db } = deps;
  const { data: sites } = await db.from("sites").select("id").eq("owner_id", userId);
  const siteIds = (sites ?? []).map((site) => site.id as string);

  const { data, error } = await db.rpc("server_delete_account", { p_user_id: userId });
  if (error) throw new DeletionError(error.message.includes("is_admin") ? "is_admin" : "failed");
  const removed = data as {
    sites: number;
    retainedPayments: number;
    purges: { siteId: string; subdomain: string | null }[];
  };

  let files = 0;
  for (const bucket of BUCKETS_BY_OWNER)
    files += await removeFolder(db, bucket, userId).catch(() => 0);
  for (const siteId of siteIds) files += await removeFolder(db, RENDERS, siteId).catch(() => 0);

  const offline: string[] = [];
  for (const purge of removed.purges) {
    if (purge.subdomain) {
      const state = await (deps.setState ?? setHostingState)(purge.subdomain, "offline").catch(
        () => "failed" as const,
      );
      if (state === "synced") offline.push(purge.subdomain);
    }
    await (deps.deleteKey ?? deleteHostingKey)(`preview:${purge.siteId}`).catch(() => "off");
  }
  if (removed.purges.length > 0) await (deps.purge ?? triggerPurge)();

  const { error: authError } = await db.auth.admin.deleteUser(userId);
  if (authError) throw new DeletionError("auth_user");
  return { sites: removed.sites, retainedPayments: removed.retainedPayments, files, offline };
}
