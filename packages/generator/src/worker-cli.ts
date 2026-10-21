#!/usr/bin/env node
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { processNextJob, supabaseJobStore } from "./worker.js";

// Runs the generation worker: takes queued jobs one at a time, or once with --once.
// Needs NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SECRET_KEY.

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
const options = { allowedImageHosts: [new URL(url).hostname] };

console.log("Worker de geração iniciado.");
do {
  const worked = await processNextJob(store, options).catch((error: unknown) => {
    console.error("Falha ao processar um pedido:", error);
    return false;
  });
  if (values.once) break;
  if (!worked) await sleep(IDLE_MS);
} while (true);
