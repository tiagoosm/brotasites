import type { SiteConfig } from "@brotasites/schema";
import { firstReadable, mostReadable } from "./color";
import { BODY_FONT_VAR, fontChoice, HEADING_FONT_VAR } from "./fonts";

const radii = {
  none: { box: "0", button: "0" },
  soft: { box: "0.75rem", button: "0.5rem" },
  round: { box: "1.5rem", button: "9999px" },
} as const;

/** Builds the CSS custom properties that drive the template's colors, fonts and shapes. */
export function themeCss(config: SiteConfig): string {
  const { primary, background, text } = config.design.colors;
  const band = config.design.colors.secondary ?? primary;
  const radius = radii[config.design.style?.borderRadius ?? "soft"];
  const fonts = fontChoice(config);

  const vars: Record<string, string> = {
    "--brand-primary": primary,
    "--brand-on-primary": mostReadable(primary, [background, text]),
    // Primary is used for accent text only when it is readable on the background.
    "--brand-accent-text": firstReadable(background, [primary, band, text]),
    "--brand-bg": background,
    "--brand-text": text,
    "--brand-band": band,
    "--brand-on-band": mostReadable(band, [background, text]),
    "--brand-radius": radius.box,
    "--brand-radius-button": radius.button,
    "--brand-heading-family": `var(${fonts.shared ? BODY_FONT_VAR : HEADING_FONT_VAR})`,
    "--brand-body-family": `var(${BODY_FONT_VAR})`,
  };

  return `:root{${Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(";")}}`;
}
