import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type SiteConfig, siteConfigSchema } from "@brotasites/schema/v1.2";
import { templatesRoot } from "@brotasites/templates";

export const fixture = (): SiteConfig =>
  siteConfigSchema.parse(
    JSON.parse(readFileSync(join(templatesRoot, "e2e/fixture-v12/site-config.json"), "utf8")),
  );

/** A tiny built site on disk: index.html plus the files given. */
export function fakeDist(html: string, files: Record<string, string | Buffer> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "brotasites-review-"));
  writeFileSync(join(dir, "index.html"), html);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

export const cleanHtml = `<!doctype html><html lang="pt-BR"><head>
<link rel="stylesheet" href="/_astro/site.css"><link rel="canonical" href="https://padaria-do-ze.sites.localhost">
<script type="application/ld+json">{"@type":"Bakery"}</script><script type="module" src="/_astro/motion.js"></script></head>
<body><header><a href="#contato">Contato</a></header><main>
<section id="abertura"><h1>Pão quentinho</h1><img src="/_astro/hero.webp" alt="Pães no balcão">
<a href="https://wa.me/5535999990000">WhatsApp</a></section>
<section id="contato"><a href="tel:+553535550000">Ligar</a><a href="mailto:contato@padariadoze.com.br">E-mail</a></section>
</main></body></html>`;

export const cleanFiles = {
  "_astro/site.css": "body{margin:0}@font-face{src:url(/fonts/fraunces/a.woff2)}",
  "_astro/motion.js": "export{}",
  "_astro/hero.webp": Buffer.alloc(2000),
  "fonts/fraunces/a.woff2": Buffer.alloc(3000),
};
