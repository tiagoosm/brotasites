import type { Palette } from "@brotasites/schema/v1.2";
import { type FontPair, fontFaceCss, fontStack } from "./fonts.js";
import type { MotionPreset } from "./motion.js";
import { PATTERN_STRENGTH } from "./patterns.js";
import { scaleVariables, type TypeScale } from "./scale.js";
import { type Shape, shapeVariables } from "./shapes.js";

// Turns the chosen tokens into the CSS custom properties the templates read.

export interface Tokens {
  palette: Palette;
  fontPair: FontPair;
  scale: TypeScale;
  shape: Shape;
  motion: MotionPreset;
}

const kebab = (role: string) => role.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

export function tokenVariables(tokens: Tokens): Record<string, string> {
  const colors = Object.fromEntries(
    Object.entries(tokens.palette).map(([role, hex]) => [`--color-${kebab(role)}`, hex]),
  );
  return {
    ...colors,
    "--pattern-color": `color-mix(in oklab, var(--color-text) ${PATTERN_STRENGTH}%, transparent)`,
    "--font-heading": fontStack(tokens.fontPair.heading),
    "--font-body": fontStack(tokens.fontPair.body),
    "--font-label": fontStack(tokens.fontPair.label),
    "--heading-weight": String(tokens.fontPair.headingWeight),
    ...scaleVariables(tokens.scale),
    ...shapeVariables(tokens.shape),
    ...tokens.motion.variables,
  };
}

/** @font-face rules plus a :root block with every token. */
export function tokensCss(tokens: Tokens, fontBaseUrl = "/fonts/"): string {
  const variables = Object.entries(tokenVariables(tokens))
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  return `${fontFaceCss(tokens.fontPair, fontBaseUrl)}\n:root{${variables}}`;
}
