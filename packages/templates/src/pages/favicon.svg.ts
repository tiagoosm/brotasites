import type { APIRoute } from "astro";
import { mostReadable } from "../lib/color";
import { loadSiteConfig } from "../lib/config";

// Simple favicon: the business initial on the primary color.
export const GET: APIRoute = () => {
  const { config } = loadSiteConfig();
  const { primary, background, text } = config.design.colors;
  const initial = config.business.name.trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${primary}"/><text x="32" y="44" font-family="system-ui, sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="${mostReadable(primary, [background, text])}">${initial.replace(/[<>&"]/g, "")}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
};
