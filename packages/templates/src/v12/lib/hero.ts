import type { SiteConfig } from "@brotasites/schema/v1.2";
import { findAsset, isStrongPhoto } from "./assets";
import { hoursSummary } from "./hours";
import { ctaLink, primaryContact } from "./links";
import type { Theme } from "./theme";

type HeroContent = Extract<SiteConfig["sections"][number], { id: "hero" }>["content"];

/** What every hero variant needs: the photo and its strength, the button, the title split. */
/**
 * The class that sizes a hero title by its longest word (site.css, .fit-w4 to .fit-w20): the
 * title shrinks until that word fits. A class, not a style attribute, for the strict CSP.
 */
export function fitTitleClass(text: string): string {
  const longest = Math.max(
    ...text
      .trim()
      .split(/\s+/)
      .map((word) => [...word].length),
  );
  return `fit-w${Math.min(20, Math.max(4, longest))}`;
}

export function heroParts(config: SiteConfig, theme: Theme, content: HeroContent) {
  const { business } = config;
  const image = findAsset(content.image?.assetId);
  const words = content.title.trim().split(/\s+/);
  const servicos = config.sections.find((section) => section.id === "servicos" && section.enabled);
  return {
    business,
    image,
    alt: content.image?.alt ?? "",
    strong: isStrongPhoto(image),
    link: content.cta ? ctaLink(content.cta, business) : primaryContact(business),
    label: content.cta?.label ?? config.navigation.ctaLabel,
    summary: hoursSummary(business.openingHours),
    /** The title without its last word, and the last word (the one a variant may accent). */
    lead: words.length > 1 ? words.slice(0, -1).join(" ") : content.title,
    accent: words.length > 1 ? words.at(-1) : undefined,
    italic: theme.highlights.includes("italic"),
    services: servicos?.id === "servicos" ? servicos.content.items.map((item) => item.name) : [],
    seed: config.design.seed,
  };
}
