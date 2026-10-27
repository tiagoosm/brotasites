import { readFileSync } from "node:fs";
import { type SiteConfig, siteConfigSchema } from "@brotasites/schema";
import { describe, expect, it } from "vitest";
import { contrastRatio, firstReadable, mostReadable } from "../src/lib/color";
import { fontChoice, fontWeights } from "../src/lib/fonts";
import {
  ctaLink,
  facebookUrl,
  instagramUrl,
  phoneUrl,
  primaryContactLink,
  whatsappUrl,
} from "../src/lib/links";
import { themeCss } from "../src/lib/theme";

const example = siteConfigSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../docs/legacy/site-config.example.v1.1.json", import.meta.url),
      "utf8",
    ),
  ),
);

function withChanges(change: (config: SiteConfig) => void): SiteConfig {
  const config = structuredClone(example);
  change(config);
  return config;
}

describe("color", () => {
  it("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#B45309", "#B45309")).toBe(1);
  });

  it("picks readable text for any background", () => {
    expect(mostReadable("#FFFBEB", ["#1C1917"])).toBe("#000000");
    expect(mostReadable("#1C1917", [])).toBe("#FFFFFF");
    for (const background of ["#FFE600", "#0A2463", "#B45309", "#25D366"]) {
      expect(contrastRatio(background, mostReadable(background, []))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the brand color for text only when it is readable", () => {
    expect(firstReadable("#FFFBEB", ["#B45309", "#1C1917"])).toBe("#B45309");
    expect(firstReadable("#FFFFFF", ["#FFE600", "#1C1917"])).toBe("#1C1917");
  });
});

describe("links", () => {
  it("builds WhatsApp, phone and Instagram links", () => {
    expect(whatsappUrl("5535999990000")).toBe("https://wa.me/5535999990000");
    expect(phoneUrl("(35) 3555-0000")).toBe("tel:+553535550000");
    // Area code 55 must not be mistaken for the country code.
    expect(phoneUrl("(55) 3222-0000")).toBe("tel:+555532220000");
    expect(phoneUrl("+55 35 99999-0000")).toBe("tel:+5535999990000");
    expect(instagramUrl("@padariadoze")).toBe("https://www.instagram.com/padariadoze");
    expect(instagramUrl("https://instagram.com/x")).toBe("https://www.instagram.com/x");
    expect(instagramUrl("instagram.com/padariadoze/")).toBe(
      "https://www.instagram.com/padariadoze",
    );
    expect(facebookUrl("facebook.com/padariadoze")).toBe("https://www.facebook.com/padariadoze");
    expect(facebookUrl("Padaria do Zé")).toBe("https://www.facebook.com/Padaria%20do%20Z%C3%A9");
  });

  it("falls back to the contact section without WhatsApp", () => {
    const config = withChanges((c) => {
      delete c.business.contact.whatsapp;
    });
    expect(primaryContactLink(config)).toEqual({ href: "#contato", external: false });
    expect(ctaLink({ label: "Fale", action: "whatsapp" }, config).href).toBe("#contato");
  });

  it("resolves every CTA action", () => {
    expect(ctaLink({ label: "x", action: "whatsapp" }, example)).toEqual({
      href: "https://wa.me/5535999990000",
      external: true,
    });
    expect(ctaLink({ label: "x", action: "phone" }, example).href).toBe("tel:+553535550000");
    expect(ctaLink({ label: "x", action: "link", target: "https://exemplo.com" }, example)).toEqual(
      { href: "https://exemplo.com", external: true },
    );
    expect(ctaLink({ label: "x", action: "scroll", target: "#faq" }, example).href).toBe("#faq");
    expect(ctaLink({ label: "x", action: "scroll" }, example).href).toBe("#contato");
  });
});

describe("theme", () => {
  it("exposes the palette as CSS variables", () => {
    const css = themeCss(example);
    expect(css).toContain("--brand-primary:#B45309");
    expect(css).toContain("--brand-bg:#FFFBEB");
    expect(css).toContain("--brand-band:#78350F");
    expect(css).toContain("--brand-radius-window:100vmax");
  });

  it("uses square windows when the client picks no rounding", () => {
    const config = withChanges((c) => {
      c.design.style = { borderRadius: "none" };
    });
    expect(themeCss(config)).toContain("--brand-radius-window:0");
  });

  it("falls back to the primary color when there is no secondary", () => {
    const config = withChanges((c) => {
      delete c.design.colors.secondary;
    });
    expect(themeCss(config)).toContain("--brand-band:#B45309");
  });
});

describe("fonts", () => {
  it("uses a light display weight for serif headings", () => {
    expect(fontChoice(example)).toMatchObject({
      heading: "Playfair Display",
      body: "Inter",
      shared: false,
      displayWeight: "400",
    });
  });

  it("downloads one family when heading and body match", () => {
    const config = withChanges((c) => {
      c.design.fonts = { heading: "Montserrat", body: "Montserrat" };
    });
    const fonts = fontChoice(config);
    expect(fonts.shared).toBe(true);
    expect(fonts.displayWeight).toBe("600");
    expect(fontWeights(fonts)).toEqual({ body: ["400", "600", "700"], heading: [] });
  });
});

describe("preview fonts", () => {
  it("builds one Google Fonts request with the right weights", async () => {
    const { googleFontsHref, previewFontCss } = await import("../src/lib/fonts");
    const fonts = fontChoice(example);
    expect(googleFontsHref(fonts)).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display:wght@400;600&display=swap",
    );
    expect(previewFontCss(fonts)).toContain('--brand-font-heading:"Playfair Display", serif');
  });
});
