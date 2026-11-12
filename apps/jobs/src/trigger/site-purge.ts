import { task } from "@trigger.dev/sdk";
import { depsFromEnv } from "../env.js";
import { runPurges } from "../purge.js";

// Removes deleted accounts' sites from R2 and KV (E15). The platform triggers it right after a
// deletion; the site_purges rows stay the source of truth, so a missed trigger is caught by the
// next one or by the local runner.
// No machine set: it only deletes files from R2 and keys from KV (no build, no browser), so the
// default small machine is enough (E37).
export const sitePurge = task({
  id: "site-purge",
  maxDuration: 600,
  retry: { maxAttempts: 2 },
  run: async () => {
    const deps = depsFromEnv(process.env);
    try {
      return { purged: await runPurges(deps.store, deps.purger, deps.log) };
    } finally {
      await deps.close();
    }
  },
});
