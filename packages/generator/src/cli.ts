#!/usr/bin/env node
import { parseArgs } from "node:util";
import { generateSite } from "./generate.js";

const usage = "Uso: brotasites-generate <config.json> [--out <pasta>] [--base </caminho>]";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" },
    base: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

const configPath = positionals[0];
if (values.help || !configPath) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

console.log(`Gerando o site a partir de ${configPath}...`);
const result = await generateSite({
  configPath,
  outDir: values.out ?? "out/site",
  base: values.base,
});

for (const warning of result.warnings) console.warn(`Aviso: ${warning}`);

if (!result.success) {
  console.error("\nNão foi possível gerar o site:");
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`\nSite gerado em ${result.outDir}`);
