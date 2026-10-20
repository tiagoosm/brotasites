import type { SiteConfig } from "@brotasites/schema";

const serifFonts = new Set(["Playfair Display", "Lora", "Roboto Slab"]);

export const HEADING_FONT_VAR = "--brand-font-heading";
export const BODY_FONT_VAR = "--brand-font-body";

export interface FontChoice {
  heading: string;
  body: string;
  /** True when heading and body use the same family, so it is registered only once. */
  shared: boolean;
}

export function fontChoice(config: SiteConfig): FontChoice {
  const heading = config.design.fonts.heading ?? "Inter";
  const body = config.design.fonts.body ?? "Inter";
  return { heading, body, shared: heading === body };
}

export function fallbacksFor(family: string): [string] {
  return [serifFonts.has(family) ? "serif" : "sans-serif"];
}
