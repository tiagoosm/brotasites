import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fontOf, fontPairOf } from "@brotasites/catalog";
import type { APIRoute, GetStaticPaths } from "astro";
import { loadAnyConfig } from "../../../lib/config";

// The font files a 1.2 site uses, with each family's license (OFL.txt must travel with them).
export const getStaticPaths: GetStaticPaths = () => {
  const loaded = loadAnyConfig();
  if (loaded.version !== "1.2" || !loaded.config.design.identity) return [];
  const { identity, overrides } = loaded.config.design;
  const pair = fontPairOf(overrides.fontPair ?? identity.fontPair);
  if (!pair) return [];
  const ids = [...new Set([pair.heading, pair.body, pair.label])];
  return ids.flatMap((font) => [
    ...fontOf(font).files.map((file) => ({ params: { font, file: file.file } })),
    { params: { font, file: "OFL.txt" } },
  ]);
};

// Found through the package (the catalog's own `fontsDir` points elsewhere once Vite bundles it).
const fontsDir = join(
  dirname(createRequire(import.meta.url).resolve("@brotasites/catalog/package.json")),
  "fonts",
);

export const GET: APIRoute = ({ params }) => {
  const font = String(params.font);
  const file = String(params.file);
  const body = readFileSync(join(fontsDir, font, file));
  const type = file.endsWith(".woff2") ? "font/woff2" : "text/plain; charset=utf-8";
  return new Response(body, { headers: { "Content-Type": type } });
};
