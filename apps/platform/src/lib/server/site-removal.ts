import type { SupabaseClient } from "@supabase/supabase-js";
import { removeFolder } from "./account-deletion";
import { deleteHostingKey } from "./hosting";
import { triggerPurge } from "./jobs";

// Removing one unpaid site (E24): discarded by its owner, or left idle for too long. The
// database removes it and keeps a record (server_discard_site, server_remove_idle_site); then,
// as for a deleted account (E15), its files go from Storage, its private preview goes from KV
// and the jobs remove what R2 holds (site_purges). An unpaid site was never published, so there
// is no public address to take offline.

export interface Removed {
  siteId: string;
  ownerId: string;
  subdomain: string | null;
  queued: boolean;
  removed: true;
}

export interface RemovalDeps {
  deleteKey?: typeof deleteHostingKey;
  purge?: typeof triggerPurge;
}

/** Storage, KV and R2 after the database removed the site. Never throws: in doubt, it retries later. */
export async function cleanUpRemovedSite(
  db: SupabaseClient,
  removed: Removed,
  deps: RemovalDeps = {},
): Promise<number> {
  let files = 0;
  for (const bucket of ["site-uploads", "site-images"]) {
    files += await removeFolder(db, bucket, `${removed.ownerId}/${removed.siteId}`).catch(() => 0);
  }
  files += await removeFolder(db, "site-renders", removed.siteId).catch(() => 0);
  await (deps.deleteKey ?? deleteHostingKey)(`preview:${removed.siteId}`).catch(() => "off");
  if (removed.queued) await (deps.purge ?? triggerPurge)().catch(() => false);
  return files;
}
