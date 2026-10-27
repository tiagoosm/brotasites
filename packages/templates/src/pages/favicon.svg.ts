import { monogramLetters } from "@brotasites/catalog";
import type { APIRoute } from "astro";
import { mostReadable } from "../lib/color";
import { loadAnyConfig } from "../lib/config";

// Simple favicon: the business initials on the primary color.
export const GET: APIRoute = () => {
  const loaded = loadAnyConfig();
  let fill: string;
  let ink: string;
  let letters: string;
  if (loaded.version === "1.2") {
    const { identity, overrides } = loaded.config.design;
    const palette = identity ? { ...identity.palette, ...overrides.colors } : undefined;
    fill = palette?.primary ?? "#1C1917";
    ink = palette?.onPrimary ?? "#FFFFFF";
    letters = monogramLetters(loaded.config.business.name) || "•";
  } else {
    const { primary, background, text } = loaded.config.design.colors;
    fill = primary;
    ink = mostReadable(primary, [background, text]);
    letters = loaded.config.business.name.trim().charAt(0).toUpperCase();
  }
  const size = letters.length > 1 ? 28 : 36;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${fill}"/><text x="32" y="${letters.length > 1 ? 42 : 44}" font-family="system-ui, sans-serif" font-size="${size}" font-weight="700" text-anchor="middle" fill="${ink}">${letters.replace(/[<>&"]/g, "")}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
};
