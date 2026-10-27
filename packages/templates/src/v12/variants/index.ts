import type { SectionId } from "@brotasites/schema/v1.2";
import ComoFuncionaSteps from "./ComoFuncionaSteps.astro";
import ContatoColumns from "./ContatoColumns.astro";
import CtaFinalBand from "./CtaFinalBand.astro";
import DepoimentosCards from "./DepoimentosCards.astro";
import DiferenciaisGrid from "./DiferenciaisGrid.astro";
import FaqAccordion from "./FaqAccordion.astro";
import GaleriaMosaic from "./GaleriaMosaic.astro";
import HeroFeast from "./HeroFeast.astro";
import HeroSplit from "./HeroSplit.astro";
import ServicosCards from "./ServicosCards.astro";
import ServicosMenu from "./ServicosMenu.astro";
import SobreManifesto from "./SobreManifesto.astro";
import SobreSplit from "./SobreSplit.astro";

// Variant id (catalog) -> component. Every id in the catalog's variant list must be here; a test
// keeps them in sync. Unknown ids fall back to the section's base variant.

// biome-ignore lint/suspicious/noExplicitAny: Astro components take per-variant props.
type Component = (props: any) => any;

export const variantComponents: Record<string, Component> = {
  "hero-split": HeroSplit,
  "hero-feast": HeroFeast,
  "sobre-split": SobreSplit,
  "sobre-manifesto": SobreManifesto,
  "servicos-cards": ServicosCards,
  "servicos-menu": ServicosMenu,
  "como-funciona-steps": ComoFuncionaSteps,
  "diferenciais-grid": DiferenciaisGrid,
  "galeria-mosaic": GaleriaMosaic,
  "depoimentos-cards": DepoimentosCards,
  "faq-accordion": FaqAccordion,
  "cta-final-band": CtaFinalBand,
  "contato-columns": ContatoColumns,
};

export const baseVariants: Record<SectionId, string> = {
  hero: "hero-split",
  sobre: "sobre-split",
  servicos: "servicos-cards",
  "como-funciona": "como-funciona-steps",
  diferenciais: "diferenciais-grid",
  galeria: "galeria-mosaic",
  depoimentos: "depoimentos-cards",
  faq: "faq-accordion",
  "cta-final": "cta-final-band",
  contato: "contato-columns",
};

export function componentFor(section: SectionId, variantId: string | undefined): Component {
  const chosen = variantId ? variantComponents[variantId] : undefined;
  return chosen ?? (variantComponents[baseVariants[section]] as Component);
}
