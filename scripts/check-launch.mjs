#!/usr/bin/env node
// pnpm check:launch: what is missing for BrotaSites to generate and serve sites in production
// (E34, docs/launch-status.md). It reads variables from the environment or from a file, and the
// Worker's settings from apps/sites-worker/wrangler.jsonc. It never prints a secret's value.
//
//   pnpm check:launch --target vercel --env vercel.env    (a file pulled with `vercel env pull`)
//   pnpm check:launch --target trigger --env trigger.env
//   pnpm check:launch --target worker
//   pnpm check:launch --target github                      (only lists what GitHub needs)
//   pnpm check:launch --online                             (network checks of the addresses)
//
// Without --target, every target is checked. Exits 1 when something required is missing.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkTarget,
  GITHUB_SETTINGS,
  nextAction,
  onlineChecks,
  parseEnv,
  workerEnvFromWrangler,
} from "./launch/requirements.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const targets = option("--target") ? [option("--target")] : ["vercel", "trigger", "worker"];
const file = option("--env");
const env = file ? { ...parseEnv(readFileSync(file, "utf8")) } : { ...process.env };

const NEED = {
  required: "obrigatória",
  generation: "geração",
  launch: "antes de clientes reais",
  optional: "opcional",
};

const results = [];
for (const target of targets) {
  if (target === "github") {
    // GitHub never shows a secret back, so nothing is read: only what to set, and where.
    console.log("\n== github ==");
    console.log(
      "Cadastre no repositório, em Settings > Environments > production (nada aqui é lido):",
    );
    for (const item of GITHUB_SETTINGS) {
      console.log(`  ${item.kind.padEnd(9)} ${item.name.padEnd(24)} ${item.workflow}`);
      console.log(`            ${item.what}`);
    }
    console.log(
      'Depois: Actions > "Deploy Worker" e "Deploy jobs" > Run workflow, digitando publicar.',
    );
    continue;
  }
  if (!["vercel", "trigger", "worker"].includes(target)) {
    console.error(`Destino desconhecido: ${target}. Use vercel, trigger, worker ou github.`);
    process.exit(2);
  }
  let source = env;
  if (target === "worker") {
    const wrangler = workerEnvFromWrangler(
      readFileSync(join(root, "apps/sites-worker/wrangler.jsonc"), "utf8"),
    );
    // EXPORT_SECRET lives in the Cloudflare dashboard and the deploy token in GitHub (E35): the
    // first is listed to check by hand, the second under --target github.
    source = { ...wrangler };
    if (wrangler.routes === 0) {
      console.log(
        "worker: wrangler.jsonc não tem rotas; com workers_dev desligado, o Worker não responderia em lugar nenhum.",
      );
    }
  }
  const result = checkTarget(target, source);
  results.push(result);
  console.log(`\n== ${target} ==`);
  for (const row of result.rows) {
    if (row.need === "optional" && row.state === "faltando") continue;
    const mark =
      row.state === "presente"
        ? "ok "
        : row.need === "optional" || row.state === "conferir"
          ? " · "
          : "✗  ";
    const where = row.state === "conferir" ? `  (${row.manual})` : "";
    console.log(`${mark} ${row.name.padEnd(38)} ${row.state.padEnd(12)} ${NEED[row.need]}${where}`);
  }
  console.log(
    result.ok
      ? "Nada obrigatório faltando."
      : `${result.blocking.length} item(ns) obrigatório(s) faltando.`,
  );
}

if (args.includes("--online")) {
  const platformUrl = env.NEXT_PUBLIC_PLATFORM_URL || "https://brotasites.com.br";
  const baseDomain = env.NEXT_PUBLIC_BASE_DOMAIN || env.BASE_DOMAIN || "brotasites.com";
  const adminHost = env.NEXT_PUBLIC_ADMIN_HOST || "admin.brotasites.com.br";
  const get = async (url) => {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    return {
      status: response.status,
      location: response.headers.get("location"),
      body: await response.text().catch(() => ""),
    };
  };
  console.log("\n== endereços ==");
  const checks = await onlineChecks({ platformUrl, adminHost, baseDomain }, get);
  for (const check of checks) {
    console.log(`${check.ok ? "ok " : "✗  "} ${check.label}: ${check.detail}  (${check.url})`);
  }
  if (checks.some((check) => !check.ok)) results.push({ ok: false, blocking: [] });
}

// --target github alone only lists what to set: there is nothing to judge.
if (results.length > 0) console.log(`\n${nextAction(results)}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
