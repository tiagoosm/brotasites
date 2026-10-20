import type { SiteConfig } from "@brotasites/schema";

const serifFonts = new Set(["Playfair Display", "Lora", "Roboto Slab"]);

export const HEADING_FONT_VAR = "--brand-font-heading";
export const BODY_FONT_VAR = "--brand-font-body";

export interface FontChoice {
  heading: string;
  body: string;
  /** True when heading and body use the same family, so it is registered only once. */
  shared: boolean;
  /** Weight for large display headings: serifs read better light, sans-serifs firmer. */
  displayWeight: "400" | "600";
}

export function fontChoice(config: SiteConfig): FontChoice {
  const heading = config.design.fonts.heading ?? "Inter";
  const body = config.design.fonts.body ?? "Inter";
  return {
    heading,
    body,
    shared: heading === body,
    displayWeight: serifFonts.has(heading) ? "400" : "600",
  };
}

export function isSerif(family: string): boolean {
  return serifFonts.has(family);
}

export function fallbacksFor(family: string): [string] {
  return [isSerif(family) ? "serif" : "sans-serif"];
}

/**
 * Google Fonts stylesheet for the live preview, where fonts change with every choice and can't
 * be registered at build time. Published sites self-host fonts through Astro Fonts instead.
 */
export function googleFontsHref(fonts: FontChoice): string {
  const weights = fontWeights(fonts);
  const family = (name: string, list: string[]) =>
    `family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@${list.join(";")}`;
  const families = [family(fonts.body, weights.body)];
  if (!fonts.shared) families.push(family(fonts.heading, weights.heading));
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

/** CSS that points the template's font variables at the Google Fonts families (preview only). */
export function previewFontCss(fonts: FontChoice): string {
  const stack = (name: string) => `"${name}", ${fallbacksFor(name)[0]}`;
  return `:root{${BODY_FONT_VAR}:${stack(fonts.body)};${HEADING_FONT_VAR}:${stack(fonts.heading)}}`;
}

/** Weights to download: body text (400, 700) and headings (400 for lead text, 600 for titles). */
export function fontWeights(fonts: FontChoice): { body: string[]; heading: string[] } {
  return fonts.shared
    ? { body: ["400", "600", "700"], heading: [] }
    : { body: ["400", "700"], heading: ["400", "600"] };
}
