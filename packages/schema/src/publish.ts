import { z } from "zod";
import { answeredContent, buildPreviewConfig, type SiteDraft } from "./draft.js";
import { draftSections } from "./draft-actions.js";
import { whatsappSchema } from "./primitives.js";
import type { Section, SectionId } from "./sections.js";
import { type SiteConfig, siteConfigSchema } from "./site-config.js";
import { businessStepSchema, type FormStepSlug } from "./steps.js";

// Publishing turns the draft into the real SiteConfig. Unlike the preview, nothing may come
// from example text: facts (contact, hours) and the client's own words must be there, or the
// part of the site that needs them must be switched off. Generic labels (section titles,
// button text) may keep their defaults.

export interface PublishProblem {
  /** The question where the client can fix it. */
  step: FormStepSlug;
  message: string;
}

export type FinalConfigResult =
  | { ok: true; config: SiteConfig }
  | { ok: false; problems: PublishProblem[] };

/** Addresses kept for the platform itself. */
export const reservedSubdomains = [
  "www",
  "app",
  "api",
  "admin",
  "painel",
  "conta",
  "entrar",
  "login",
  "mail",
  "email",
  "smtp",
  "ftp",
  "blog",
  "status",
  "ajuda",
  "suporte",
  "docs",
  "cdn",
  "static",
  "assets",
  "dev",
  "staging",
  "teste",
  "test",
  "preview",
  "previa",
  "brotasites",
] as const;

export function isReservedSubdomain(subdomain: string): boolean {
  return (reservedSubdomains as readonly string[]).includes(subdomain);
}

const sectionNames: Record<SectionId, string> = {
  hero: "Topo",
  sobre: "Sobre",
  servicos: "Serviços",
  galeria: "Galeria de fotos",
  depoimentos: "Depoimentos",
  faq: "Perguntas frequentes",
  "cta-final": "Chamada final",
  contato: "Contato e mapa",
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const items = (value: unknown) =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
const emailSchema = z.email();

/** What is still missing before the draft can become a site, in form order. */
export function publishProblems(draft: SiteDraft): PublishProblem[] {
  const problems: PublishProblem[] = [];
  const business = draft.business;
  const contact = business?.contact;

  const basics = businessStepSchema.safeParse({
    name: business?.name ?? "",
    category: business?.category ?? "",
    city: contact?.address?.city ?? "",
  });
  if (!basics.success) {
    for (const issue of basics.error.issues) {
      problems.push({ step: "negocio", message: issue.message });
    }
  }

  const sections = draftSections(draft);
  const enabled = sections.filter((section) => section.enabled);
  const off = (id: SectionId) => `Escreva o que falta ou desligue a seção ${sectionNames[id]}.`;
  for (const section of enabled) {
    const content = answeredContent(section.id, section.content);
    switch (section.id) {
      case "sobre":
        if (!text(content.text))
          problems.push({
            step: "conteudo",
            message: `Falta o texto da seção Sobre. ${off("sobre")}`,
          });
        break;
      case "servicos":
        if (!items(content.items).length)
          problems.push({
            step: "conteudo",
            message: `Falta pelo menos um serviço. ${off("servicos")}`,
          });
        break;
      case "faq":
        if (!items(content.items).some((item) => text(item.question) && text(item.answer)))
          problems.push({
            step: "conteudo",
            message: `Falta pelo menos uma pergunta com resposta. ${off("faq")}`,
          });
        break;
      case "galeria":
        if (!items(content.images).length)
          problems.push({
            step: "contato",
            message: "A galeria ainda não tem fotos. Envie pelo menos uma ou desligue a galeria.",
          });
        break;
    }
    const cta = content.cta as { action?: string; target?: string } | undefined;
    if (cta?.action === "link" && !/^https?:\/\/\S+$/i.test(text(cta.target))) {
      problems.push({
        step: "conteudo",
        message: `O botão da seção ${sectionNames[section.id]} leva para outro site, mas falta um endereço que comece com https://.`,
      });
    }
  }

  // Buttons default to WhatsApp, so the site needs a number unless every button goes elsewhere.
  const actions = enabled
    .filter((section) => section.id === "hero" || section.id === "cta-final")
    .map(
      (section) => (section.content?.cta as { action?: string } | undefined)?.action ?? "whatsapp",
    );
  const whatsapp = text(contact?.whatsapp);
  if (whatsapp && !whatsappSchema.safeParse(whatsapp).success) {
    problems.push({
      step: "contato",
      message: "Confira o WhatsApp: com DDD, como (35) 99999-0000.",
    });
  } else if (!whatsapp && actions.includes("whatsapp")) {
    problems.push({
      step: "contato",
      message: "Informe o WhatsApp. Os botões do site levam para ele.",
    });
  }
  if (actions.includes("phone") && !text(contact?.phone)) {
    problems.push({
      step: "contato",
      message: "Informe o telefone. Um botão do site leva para ele.",
    });
  }
  const email = text(contact?.email);
  if (email && !emailSchema.safeParse(email).success) {
    problems.push({ step: "contato", message: "Confira o e-mail, como voce@exemplo.com." });
  }

  return problems;
}

/** Optional texts that come from the example placeholders unless the client wrote them. */
const exampleOnly: Partial<Record<SectionId, string[]>> = {
  hero: ["subtitle"],
  "cta-final": ["subtitle"],
};

/**
 * The SiteConfig to publish, or the problems to fix first. The subdomain must already be
 * chosen (question 7); availability is checked by the platform, not here.
 */
export function buildFinalConfig(draft: SiteDraft): FinalConfigResult {
  const problems = publishProblems(draft);
  if (!draft.site?.subdomain) {
    problems.push({ step: "endereco", message: "Escolha o endereço do site." });
  }
  if (problems.length) return { ok: false, problems };

  const preview = buildPreviewConfig(draft);
  const sections = preview.sections.map((section): Section => {
    const answered = answeredContent(
      section.id,
      draftSections(draft).find((s) => s.id === section.id)?.content,
    );
    const content = { ...section.content } as Record<string, unknown>;
    for (const key of exampleOnly[section.id] ?? []) {
      if (!(key in answered)) delete content[key];
    }
    return { ...section, content } as Section;
  });

  const result = siteConfigSchema.safeParse({
    ...preview,
    site: { ...preview.site, subdomain: draft.site?.subdomain },
    sections,
  });
  if (!result.success) {
    return {
      ok: false,
      problems: [
        {
          step: "endereco",
          message: "Algumas respostas não puderam ser usadas. Revise as perguntas e tente de novo.",
        },
      ],
    };
  }
  if (isReservedSubdomain(result.data.site.subdomain)) {
    return {
      ok: false,
      problems: [{ step: "endereco", message: "Esse endereço é reservado. Escolha outro." }],
    };
  }
  return { ok: true, config: result.data };
}
