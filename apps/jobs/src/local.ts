#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { serveDir } from "@brotasites/reviewer";
import { depsFromEnv } from "./env.js";
import { JOB_KINDS, runJob } from "./pipeline.js";

// The local runner, for development without Trigger.dev: takes queued jobs one at a time and
// serves the previews at http://localhost:<port>/<site id>/<token>/ (set PREVIEW_ORIGIN on the
// platform to that address). Needs the Supabase variables; the R2 ones only to publish.

const root = resolve(process.env.LOCAL_PREVIEWS_DIR ?? ".previews");
await mkdir(root, { recursive: true });
const server = await serveDir(root);
console.log(`Prévias locais em ${server.url}`);

const deps = depsFromEnv(process.env, { localPreviews: root });
process.on("SIGINT", async () => {
  await deps.close();
  await server.close();
  process.exit(0);
});

for (;;) {
  const job = await deps.store.claimJob(JOB_KINDS).catch((error: unknown) => {
    console.error("Falha ao buscar pedidos:", error);
    return null;
  });
  if (!job) {
    await sleep(3000);
    continue;
  }
  console.log(`Rodando ${job.kind} do site ${job.siteId} (tentativa ${job.attempts})`);
  console.log(`  -> ${await runJob(deps, job)}`);
}
