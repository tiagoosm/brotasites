import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compatibleFontPairs,
  fontFaceCss,
  fontOf,
  fontPairFiles,
  fontPairs,
  fonts,
  fontsDir,
  personalities,
} from "../src/index.js";

describe("fonts", () => {
  it("ships every file with its OFL license", () => {
    for (const font of fonts) {
      const license = readFileSync(join(fontsDir, font.id, "OFL.txt"), "utf8");
      expect(license).toContain("SIL Open Font License");
      for (const file of font.files) {
        const data = readFileSync(join(fontsDir, font.id, file.file));
        expect(data.subarray(0, 4).toString("latin1")).toBe("wOF2");
      }
    }
  });

  it("is listed in THIRD_PARTY_LICENSES.md", () => {
    const notices = readFileSync(
      new URL("../../../THIRD_PARTY_LICENSES.md", import.meta.url),
      "utf8",
    );
    for (const font of fonts) {
      expect(notices).toContain(font.name);
      expect(notices).toContain(font.repository);
    }
  });

  it("has pairs that reference known fonts in the right roles", () => {
    for (const pair of fontPairs) {
      expect(["serif", "sans", "rounded"]).toContain(fontOf(pair.heading).category);
      expect(fontOf(pair.body).category).toBe("sans");
      expect(fontOf(pair.label).category).toBe("handwritten");
      for (const file of fontPairFiles(pair)) expect(existsSync(join(fontsDir, file))).toBe(true);
    }
    expect(new Set(fontPairs.map((pair) => pair.id)).size).toBe(fontPairs.length);
  });

  it("offers at least 2 pairs to every personality", () => {
    for (const personality of personalities) {
      expect(compatibleFontPairs(personality).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("writes @font-face rules that only point at the site", () => {
    const css = fontFaceCss(fontPairs[0] as (typeof fontPairs)[number]);
    expect(css).toContain("font-display:swap");
    expect(css.match(/url\("([^"]+)"\)/g)?.every((url) => url.startsWith('url("/fonts/'))).toBe(
      true,
    );
  });
});

describe("heading highlights", () => {
  it("offer italics only with a real italic file", async () => {
    const { headingHighlights, fontPairOf } = await import("../src/index.js");
    expect(headingHighlights(fontPairOf("fraunces-manrope") as never)).toContain("italic");
    expect(headingHighlights(fontPairOf("bricolage-dm-sans") as never)).not.toContain("italic");
  });
});
