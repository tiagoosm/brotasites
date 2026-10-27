import { hashString, hexToOklch } from "@brotasites/catalog";
import type { Identity } from "@brotasites/schema/v1.2";

// The design features two sites are compared by, their distance (0 = same design, 1 = nothing
// in common) and the fingerprint stored with each site.

export interface DesignFeatures {
  personality: string;
  fontPair: string;
  heroVariant: string;
  typeScale: string;
  shape: string;
  ornamentSet: string;
  pattern: string;
  dividerStyle: string;
  imageTreatment: string;
  rhythm: string;
  markStyle: string;
  mode: "light" | "dark";
  /** Hue (degrees) and chroma of the primary color. */
  hue: number;
  chroma: number;
}

export function featuresOf(identity: Omit<Identity, "fingerprint">): DesignFeatures {
  const primary = hexToOklch(identity.palette.primary);
  return {
    personality: identity.personality,
    fontPair: identity.fontPair,
    heroVariant: identity.heroVariant,
    typeScale: identity.typeScale,
    shape: identity.shape,
    ornamentSet: identity.ornamentSet,
    pattern: identity.pattern,
    dividerStyle: identity.dividerStyle,
    imageTreatment: identity.imageTreatment,
    rhythm: identity.rhythm,
    markStyle: identity.markStyle,
    mode: hexToOklch(identity.palette.background).l < 0.5 ? "dark" : "light",
    hue: Math.round(primary.h),
    chroma: Math.round(primary.c * 1000) / 1000,
  };
}

/** Weight of each categorical feature; with mode and hue they add up to 1. */
const weights = {
  personality: 0.12,
  fontPair: 0.14,
  heroVariant: 0.14,
  typeScale: 0.04,
  shape: 0.06,
  ornamentSet: 0.06,
  pattern: 0.05,
  dividerStyle: 0.05,
  imageTreatment: 0.04,
  rhythm: 0.05,
  markStyle: 0.03,
} as const;
const MODE_WEIGHT = 0.08;
const HUE_WEIGHT = 0.14;

export function designDistance(a: DesignFeatures, b: DesignFeatures): number {
  let distance = 0;
  for (const [key, weight] of Object.entries(weights) as [keyof typeof weights, number][]) {
    if (a[key] !== b[key]) distance += weight;
  }
  if (a.mode !== b.mode) distance += MODE_WEIGHT;
  const hueGap = Math.min(Math.abs(a.hue - b.hue), 360 - Math.abs(a.hue - b.hue));
  // The hue of a near-gray color says little: weigh it by how colorful the grayer one is.
  const colorfulness = Math.min(1, Math.min(a.chroma, b.chroma) / 0.05);
  distance += HUE_WEIGHT * (hueGap / 180) * colorfulness;
  return Math.round(distance * 1000) / 1000;
}

/** 16 hex characters from the features, with the hue rounded to 15° steps. */
export function fingerprintOf(features: DesignFeatures): string {
  const canonical = JSON.stringify({
    ...features,
    hue: Math.round(features.hue / 15) % 24,
    chroma: Math.round(features.chroma * 20),
  });
  const a = hashString(canonical).toString(16).padStart(8, "0");
  const b = hashString(`brotasites|${canonical}`).toString(16).padStart(8, "0");
  return a + b;
}
