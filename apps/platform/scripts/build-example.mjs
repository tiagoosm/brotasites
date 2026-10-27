// Builds the example site (Padaria do Zé, docs/legacy/site-config.example.v1.1.json) with the real
// generator into public/exemplo-site, served under /exemplo-site and shown at /exemplo.
// Runs before `next build`; the output is generated, not committed.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generateSite } from "@brotasites/generator";

const configPath = fileURLToPath(
  new URL("../../../docs/legacy/site-config.example.v1.1.json", import.meta.url),
);
const outDir = fileURLToPath(new URL("../public/exemplo-site", import.meta.url));

await rm(outDir, { recursive: true, force: true });
const result = await generateSite({ configPath, outDir, base: "/exemplo-site" });
for (const warning of result.warnings) console.warn(`Aviso: ${warning}`);
if (!result.success) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}
console.log(`Site de exemplo gerado em ${outDir}`);
