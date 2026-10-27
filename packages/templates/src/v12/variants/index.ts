import type { SectionId } from "@brotasites/schema/v1.2";
import ComoFuncionaCards from "./ComoFuncionaCards.astro";
import ComoFuncionaPath from "./ComoFuncionaPath.astro";
import ComoFuncionaSteps from "./ComoFuncionaSteps.astro";
import ContatoCard from "./ContatoCard.astro";
import ContatoColumns from "./ContatoColumns.astro";
import ContatoSplit from "./ContatoSplit.astro";
import CtaFinalBand from "./CtaFinalBand.astro";
import CtaFinalPoster from "./CtaFinalPoster.astro";
import CtaFinalStamp from "./CtaFinalStamp.astro";
import DepoimentosCards from "./DepoimentosCards.astro";
import DepoimentosNotes from "./DepoimentosNotes.astro";
import DepoimentosQuote from "./DepoimentosQuote.astro";
import DiferenciaisGrid from "./DiferenciaisGrid.astro";
import DiferenciaisRibbon from "./DiferenciaisRibbon.astro";
import DiferenciaisSplit from "./DiferenciaisSplit.astro";
import FaqAccordion from "./FaqAccordion.astro";
import FaqColumns from "./FaqColumns.astro";
import FaqSplit from "./FaqSplit.astro";
import GaleriaGrid from "./GaleriaGrid.astro";
import GaleriaMosaic from "./GaleriaMosaic.astro";
import GaleriaPolaroids from "./GaleriaPolaroids.astro";
import HeroArch from "./HeroArch.astro";
import HeroBento from "./HeroBento.astro";
import HeroCollage from "./HeroCollage.astro";
import HeroFeast from "./HeroFeast.astro";
import HeroFullbleed from "./HeroFullbleed.astro";
import HeroPoster from "./HeroPoster.astro";
import HeroSplit from "./HeroSplit.astro";
import ServicosCards from "./ServicosCards.astro";
import ServicosList from "./ServicosList.astro";
import ServicosMenu from "./ServicosMenu.astro";
import SobreCard from "./SobreCard.astro";
import SobreManifesto from "./SobreManifesto.astro";
import SobreSplit from "./SobreSplit.astro";

// Variant id (catalog) -> component. Every id in the catalog's variant list must be here; a test
// keeps them in sync. Unknown ids fall back to the section's base variant.

// biome-ignore lint/suspicious/noExplicitAny: Astro components take per-variant props.
type Component = (props: any) => any;

export const variantComponents: Record<string, Component> = {
  "hero-split": HeroSplit,
  "sobre-split": SobreSplit,
  "servicos-cards": ServicosCards,
  "como-funciona-steps": ComoFuncionaSteps,
  "diferenciais-grid": DiferenciaisGrid,
  "galeria-mosaic": GaleriaMosaic,
  "depoimentos-cards": DepoimentosCards,
  "faq-accordion": FaqAccordion,
  "cta-final-band": CtaFinalBand,
  "contato-columns": ContatoColumns,
  "hero-feast": HeroFeast,
  "hero-poster": HeroPoster,
  "hero-fullbleed": HeroFullbleed,
  "hero-arch": HeroArch,
  "hero-bento": HeroBento,
  "hero-collage": HeroCollage,
  "sobre-manifesto": SobreManifesto,
  "sobre-card": SobreCard,
  "servicos-menu": ServicosMenu,
  "servicos-list": ServicosList,
  "como-funciona-cards": ComoFuncionaCards,
  "como-funciona-path": ComoFuncionaPath,
  "diferenciais-split": DiferenciaisSplit,
  "diferenciais-ribbon": DiferenciaisRibbon,
  "galeria-polaroids": GaleriaPolaroids,
  "galeria-grid": GaleriaGrid,
  "depoimentos-quote": DepoimentosQuote,
  "depoimentos-notes": DepoimentosNotes,
  "faq-columns": FaqColumns,
  "faq-split": FaqSplit,
  "cta-final-poster": CtaFinalPoster,
  "cta-final-stamp": CtaFinalStamp,
  "contato-card": ContatoCard,
  "contato-split": ContatoSplit,
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
