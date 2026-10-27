import { GRAIN_SVG } from "@brotasites/catalog";
import type { APIRoute, GetStaticPaths } from "astro";
import { loadAnyConfig } from "../../lib/config";
import { resolveTheme } from "../../v12/lib/theme";

// Files of a 1.2 site generated at build time: its stylesheet of tokens and the grain texture.
// 1.1 sites have none.
export const getStaticPaths: GetStaticPaths = () =>
  loadAnyConfig().version === "1.2"
    ? [{ params: { file: "site.css" } }, { params: { file: "grain.svg" } }]
    : [];

export const GET: APIRoute = ({ params }) => {
  if (params.file === "grain.svg") {
    return new Response(GRAIN_SVG, { headers: { "Content-Type": "image/svg+xml" } });
  }
  const loaded = loadAnyConfig();
  if (loaded.version !== "1.2") return new Response(null, { status: 404 });
  return new Response(resolveTheme(loaded.config).css, { headers: { "Content-Type": "text/css" } });
};
