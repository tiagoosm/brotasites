#!/usr/bin/env node
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { deployToR2, type R2Options } from "./r2.js";
import { processNextJob, supabaseJobStore, type WorkerOptions } from "./worker.js";

// Runs the generation worker: takes queued jobs one at a time, or once with --once.
// Needs NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SECRET_KEY. With the R2
// variables (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) sites also go
// live; without them they wait in "publishing".

const IDLE_MS = 5000;

const { values } = parseArgs({ options: { once: { type: "boolean" } } });
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY para rodar o worker.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const store = supabaseJobStore(supabase);
const r2 = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET ?? "brotasites-sites",
};
const canDeploy = Boolean(r2.accountId && r2.accessKeyId && r2.secretAccessKey);
const options: WorkerOptions = {
  allowedImageHosts: [new URL(url).hostname],
  deploy: canDeploy
    ? async (outDir, config) => {
        await deployToR2(outDir, config, r2 as R2Options);
      }
    : undefined,
};

console.log(
  canDeploy
    ? "Worker de geração iniciado. Os sites vão ao ar pelo R2."
    : "Worker de geração iniciado, sem publicação (faltam as variáveis do R2).",
);
for (;;) {
  const worked = await processNextJob(store, options).catch((error: unknown) => {
    console.error("Falha ao processar um pedido:", error);
    return false;
  });
  if (values.once) break;
  if (!worked) await sleep(IDLE_MS);
}
