import type { SupabaseClient } from "@supabase/supabase-js";
import { limits } from "@/config/limits";
import { cleanUpRemovedSite, type RemovalDeps, type Removed } from "./site-removal";

// The daily cleanup of unpaid sites left idle (E24), run by the same Vercel Cron as the
// Supabase keep-alive (E21): one schedule, already in the project. First the in-site warnings
// (no emails this round), then the removals: a small batch per run, each one checked again by
// the database under a lock (in doubt, nothing goes), the same path as discarding.

export interface CleanupResult {
  warned: number;
  removed: number;
  skipped: number;
  failed: number;
}

export async function runIdleCleanup(
  db: SupabaseClient,
  deps: RemovalDeps & { log?: (message: string) => void } = {},
): Promise<CleanupResult> {
  const result: CleanupResult = { warned: 0, removed: 0, skipped: 0, failed: 0 };
  const idleDays = limits.idleDaysBeforeDeletion;

  const warned = await db.rpc("server_warn_idle_sites", {
    p_idle_days: idleDays,
    p_thresholds: [...limits.deletionWarningDays],
  });
  if (warned.error) deps.log?.(`cleanup warnings failed: ${warned.error.message}`);
  else result.warned = Number(warned.data ?? 0);

  const due = await db.rpc("server_idle_sites", {
    p_idle_days: idleDays,
    p_within_days: 0,
    p_limit: limits.cleanupBatch,
  });
  if (due.error) {
    deps.log?.(`cleanup list failed: ${due.error.message}`);
    return result;
  }
  for (const row of (due.data ?? []) as { site_id: string }[]) {
    const removed = await db.rpc("server_remove_idle_site", {
      p_site_id: row.site_id,
      p_idle_days: idleDays,
    });
    if (removed.error) {
      result.failed += 1;
      deps.log?.(`cleanup of ${row.site_id} failed: ${removed.error.message}`);
      continue;
    }
    const answer = removed.data as Removed | { removed: false };
    if (!answer.removed) {
      result.skipped += 1;
      continue;
    }
    result.removed += 1;
    await cleanUpRemovedSite(db, answer, deps);
  }
  return result;
}
