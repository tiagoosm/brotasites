import { contrastRatio, luminance } from "@brotasites/schema";
import { contrastIssues } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import {
  createRandom,
  enforceContrast,
  ensureContrast,
  generatePalette,
  gradientBackground,
  hexToOklch,
  oklchToHex,
  personalities,
  personalityPalettes,
} from "../src/index.js";

const brands = [
  undefined,
  "#B45309",
  "#1D4ED8",
  "#FDE047",
  "#777777",
  "#000000",
  "#FFFFFF",
  "#E11D48",
  "#16A34A",
];

describe("OKLCH", () => {
  it("round-trips hex colors", () => {
    for (const hex of ["#B45309", "#1C1917", "#FFFBEB", "#3B82F6", "#000000", "#FFFFFF"]) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it("maps out-of-gamut colors into sRGB", () => {
    expect(oklchToHex({ l: 0.7, c: 0.4, h: 150 })).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("fixes contrast by moving lightness", () => {
    const fixed = ensureContrast("#9CA3AF", "#FFFFFF", 4.5);
    expect(contrastRatio(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("palettes", () => {
  it("pass AA for every personality, mode, brand color and many seeds", () => {
    let count = 0;
    for (const personality of personalities) {
      for (const mode of personalityPalettes[personality].modes) {
        for (const brand of brands) {
          for (let round = 0; round < 12; round++) {
            for (const keepBrandColor of [false, true]) {
              const palette = generatePalette({
                personality,
                mode,
                random: createRandom(`${personality}|${brand}|${round}`),
                brandColors: brand ? [brand] : [],
                keepBrandColor,
                hueShift: round % 3 === 0 ? 0 : round * 17,
              });
              expect(contrastIssues(palette), JSON.stringify(palette)).toEqual([]);
              expect(contrastRatio(palette.primary, palette.background)).toBeGreaterThanOrEqual(3);
              expect(contrastRatio(palette.accent, palette.background)).toBeGreaterThanOrEqual(3);
              count++;
            }
          }
        }
      }
    }
    expect(count).toBeGreaterThan(1000);
  });

  it("keeps the brand color exactly when it reads on the background", () => {
    const palette = generatePalette({
      personality: "acolhedor",
      random: createRandom("x"),
      brandColors: ["#B45309", "#78350F"],
      keepBrandColor: true,
    });
    expect(palette.primary).toBe("#B45309");
    expect(palette.accent).toBe("#78350F");
  });

  it("follows the brand hue", () => {
    const palette = generatePalette({
      personality: "moderno",
      random: createRandom("x"),
      brandColors: ["#1D4ED8"],
    });
    expect(Math.abs(hexToOklch(palette.primary).h - hexToOklch("#1D4ED8").h)).toBeLessThan(12);
  });

  it("is deterministic", () => {
    const make = () => generatePalette({ personality: "ousado", random: createRandom("seed-1") });
    expect(make()).toEqual(make());
  });

  it("repairs client overrides that break contrast", () => {
    const palette = enforceContrast({
      background: "#FFFFFF",
      surface: "#F5F5F5",
      text: "#BBBBBB",
      textMuted: "#DDDDDD",
      primary: "#FFFF00",
      onPrimary: "#FFFFFF",
      accent: "#EEEEEE",
    });
    expect(contrastIssues(palette)).toEqual([]);
  });
});

describe("gradient backgrounds", () => {
  it("keep text readable on every color they reach", () => {
    for (const personality of personalities) {
      for (const mode of personalityPalettes[personality].modes) {
        for (let round = 0; round < 20; round++) {
          const random = createRandom(`${personality}-${mode}-${round}`);
          const palette = generatePalette({ personality, mode, random });
          const gradient = gradientBackground(random, palette);
          const textIsDark = luminance(palette.text) < luminance(palette.background);
          for (const stop of gradient.stops) {
            expect(contrastRatio(palette.text, stop)).toBeGreaterThanOrEqual(4.5);
            // All stops on the same side of the text, so blends between them stay readable.
            expect(luminance(stop) > luminance(palette.text)).toBe(textIsDark);
          }
          expect(gradient.background).not.toMatch(/url\(/);
        }
      }
    }
  });
});
