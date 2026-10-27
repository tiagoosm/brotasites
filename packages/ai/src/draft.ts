import type { Copy, CopyInput } from "./copy.js";

// Copy without the AI: the client's own text, with plain fallbacks where a field is empty. It is
// what the site gets when the AI is off, over its limits or failed twice, and it is the answer
// of the simulated model. It only reuses the client's words and fixed labels, so it never adds
// a fact.

const ctaLabels: Record<string, string> = {
  whatsapp: "Chamar no WhatsApp",
  phone: "Ligar",
  email: "Mandar e-mail",
  directions: "Como chegar",
  section: "Saiba mais",
};

/** Cuts at a word boundary, without a trailing comma or connector. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.5 ? cut.slice(0, space) : clean.slice(0, max))
    .replace(/[\s,;:–—-]+$/, "")
    .trim();
}

function firstSentence(text: string): string {
  return /^(.+?[.!?])(\s|$)/.exec(text.trim())?.[1] ?? text.trim();
}

export function draftCopy(input: CopyInput): Copy {
  const { business, sections } = input;
  const place = business.district ? `${business.district}, ${business.city}` : business.city;
  const firstService = sections.servicos?.items?.[0]?.name;
  const heroTitle =
    sections.hero.title ||
    business.tagline ||
    (firstService ? `${firstService} em ${business.city}` : `${business.name} em ${business.city}`);
  const heroSubtitle =
    sections.hero.subtitle || clip(firstSentence(business.description || ""), 200);
  const ctaLabel =
    sections.hero.ctaLabel ||
    ctaLabels[sections.hero.ctaAction ?? business.contactChannels[0] ?? "section"] ||
    "Saiba mais";

  const copy: Copy = {
    hero: {
      title: clip(heroTitle, 80),
      subtitle: clip(heroSubtitle, 200),
      ctaLabel: clip(ctaLabel, 30),
    },
    seo: {
      title: clip(`${business.name} | ${business.category} em ${business.city}`, 70),
      description: clip(business.description || `${business.name}, ${place}.`, 160),
      keywords: [
        ...new Set(
          [
            business.category,
            business.city,
            ...(sections.servicos?.items ?? []).map((item) => item.name),
          ]
            .filter(Boolean)
            .map((keyword) => clip(keyword.toLowerCase(), 40)),
        ),
      ].slice(0, 10),
    },
    navigation: { ctaLabel: clip(ctaLabel, 30) },
  };
  if (sections.sobre) {
    copy.sobre = {
      title: clip(sections.sobre.title || "Quem somos", 60),
      text: clip(sections.sobre.text || business.description || "", 800),
    };
  }
  if (sections.servicos) {
    copy.servicos = {
      title: clip(sections.servicos.title || "Serviços", 60),
      items: (sections.servicos.items ?? []).map((item) => ({
        description: clip(item.description ?? "", 200),
      })),
    };
  }
  const steps = sections["como-funciona"];
  if (steps) {
    copy["como-funciona"] = {
      title: clip(steps.title || "Como funciona", 60),
      steps: steps.steps.map((step) => ({
        title: clip(step.title, 60),
        text: clip(step.text, 200),
      })),
    };
  }
  if (sections.diferenciais) {
    copy.diferenciais = {
      title: clip(sections.diferenciais.title || "Por que escolher", 60),
      items: (sections.diferenciais.items ?? []).map((item) => ({
        title: clip(item.title, 60),
        text: clip(item.text ?? "", 200),
      })),
    };
  }
  if (sections.faq) {
    copy.faq = {
      title: clip(sections.faq.title || "Perguntas frequentes", 60),
      items: sections.faq.items.map((item) => ({
        question: clip(item.question, 120),
        answer: clip(item.answer, 400),
      })),
    };
  }
  if (sections.galeria) copy.galeria = { title: clip(sections.galeria.title || "Fotos", 60) };
  if (sections.depoimentos) {
    copy.depoimentos = { title: clip(sections.depoimentos.title || "Quem já veio", 60) };
  }
  if (sections.contato) copy.contato = { title: clip(sections.contato.title || "Contato", 60) };
  const finalCta = sections["cta-final"];
  if (finalCta) {
    copy["cta-final"] = {
      title: clip(finalCta.title || "Fale com a gente", 80),
      subtitle: clip(finalCta.subtitle ?? "", 160),
      ctaLabel: clip(
        finalCta.ctaLabel || ctaLabels[finalCta.ctaAction ?? "section"] || "Saiba mais",
        30,
      ),
    };
  }
  return copy;
}
