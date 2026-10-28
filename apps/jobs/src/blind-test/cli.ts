#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { aiProviderFromEnv } from "@brotasites/ai";
import { reviewerAgentFromEnv, serveDir } from "@brotasites/reviewer";
import { type AnswerKey, assembleKit } from "./assemble.js";
import { kitBusinesses } from "./businesses.js";
import { generateSites, isFinished } from "./generate.js";
import { formatScore, parseAnswers, scoreAnswers } from "./score.js";

// The blind test kit (docs/blind-test.md):
//   generate  the BrotaSites half, through the real pipeline (AI_MODE=live for the real test)
//   assemble  mixes it with the hand-made half into the participants' folder and the answer key
//   serve     serves the participants' folder on this computer
//   score     reads the answers and says whether the target was met

const usage = `Uso: blind-test <comando> [opções]
  generate [--out kit] [--photos <pasta>]
  assemble [--out kit] [--seed <texto>]
  serve    [--out kit] [--port 4600]
  score    [--out kit] [--answers <arquivo.csv>]`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: "kit" },
    photos: { type: "string" },
    seed: { type: "string" },
    port: { type: "string", default: "4600" },
    answers: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

const out = resolve(values.out);
const command = positionals[0];

if (values.help || !command) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

if (command === "generate") {
  const env = process.env;
  if ((env.AI_MODE || "simulated") === "simulated") {
    console.warn(
      "Aviso: AI_MODE=simulated. Os textos saem do modo simulado; para o teste de verdade use AI_MODE=live.",
    );
  }
  const sites = await generateSites({
    out,
    businesses: kitBusinesses(),
    photosDir: values.photos && resolve(values.photos),
    deps: (store) => ({
      ai: aiProviderFromEnv(env, {
        registry: store.registry,
        usage: store.usage,
        cache: store.cache,
      }),
      agent: reviewerAgentFromEnv(env),
      // The kit needs only the finished sites, not the pictures of the three directions.
      screenshot: async () => [],
      log: (message) => console.error(message),
    }),
    log: (message) => console.log(message),
  });
  const failed = sites.filter((site) => !isFinished(site));
  console.log(
    `\n${sites.length - failed.length} de ${sites.length} sites prontos em ${join(out, "generated")}`,
  );
  console.log(`Resumos para quem vai fazer os sites à mão: ${join(out, "briefs")}`);
  for (const site of failed) console.error(`  - ${site.name}: ${site.status}`);
  process.exit(failed.length ? 1 : 0);
} else if (command === "assemble") {
  const names = Object.fromEntries(kitBusinesses().map((b) => [b.slug, b.facts.name]));
  const result = await assembleKit({
    kitDir: out,
    seed: values.seed ?? new Date().toISOString().slice(0, 10),
    names,
  });
  for (const item of result.missing) console.warn(`Falta: ${item}`);
  for (const warning of result.warnings) console.warn(`Aviso: ${warning}`);
  console.log(`\n${result.key.pairs.length} pares em ${join(out, "participantes")}`);
  console.log(`Chave (não mostre aos participantes): ${join(out, "chave", "chave.json")}`);
  process.exit(result.warnings.length ? 1 : 0);
} else if (command === "serve") {
  const server = await serveDir(join(out, "participantes"), "/", Number(values.port));
  console.log(`Kit em ${server.url} (Ctrl+C para parar)`);
} else if (command === "score") {
  const key = JSON.parse(await readFile(join(out, "chave", "chave.json"), "utf8")) as AnswerKey;
  const csv = await readFile(
    resolve(values.answers ?? join(out, "chave", "respostas.csv")),
    "utf8",
  );
  const { answers, errors } = parseAnswers(csv);
  for (const error of errors) console.error(error);
  if (answers.length === 0) {
    console.error("Nenhuma resposta para apurar.");
    process.exit(1);
  }
  console.log(formatScore(scoreAnswers(key, answers)));
  process.exit(errors.length ? 1 : 0);
} else {
  console.log(usage);
  process.exit(1);
}
