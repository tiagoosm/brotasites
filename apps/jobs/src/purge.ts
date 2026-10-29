import type { PipelineStore, SitePurge } from "./store.js";

// The hosting cleanup of deleted accounts (E15): each site's versions, exports and previews in
// R2 and its records in KV go (generator purgeSite). The site was already offline in KV since
// the deletion; this frees the storage. A failure is retried, up to 5 attempts.

export type Purger = (site: Pick<SitePurge, "siteId" | "subdomain">) => Promise<number>;

export async function runPurges(
  store: PipelineStore,
  purger: Purger | undefined,
  log: (message: string) => void = () => {},
  max = 20,
): Promise<number> {
  if (!purger) return 0;
  let done = 0;
  for (let i = 0; i < max; i++) {
    const purge = await store.claimPurge();
    if (!purge) break;
    try {
      const files = await purger(purge);
      await store.finishPurge(purge.id);
      log(`Limpeza do site ${purge.siteId}: ${files} arquivo(s) removido(s).`);
      done++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.finishPurge(purge.id, message);
      log(`Limpeza do site ${purge.siteId} falhou (tentativa ${purge.attempts}): ${message}`);
    }
  }
  return done;
}
