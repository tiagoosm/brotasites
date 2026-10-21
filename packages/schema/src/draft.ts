import type { z } from "zod";
import { findCategory, findPalette } from "./categories.js";
import { hexColorSchema, subdomainSchema } from "./primitives.js";
import { type Section, type SectionId, sectionIds, sectionSchema } from "./sections.js";
import {
  bodyFonts,
  headingFonts,
  SCHEMA_VERSION,
  type SiteConfig,
  siteConfigSchema,
} from "./site-config.js";

// A draft is what the form has collected so far: anything may be missing or half-typed.
// `buildPreviewConfig` turns it into a valid SiteConfig for the live preview, filling the
// gaps with neutral placeholders. Placeholders are for the preview only: publishing
// validates the real config with `siteConfigSchema`.

type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export interface DraftSection {
  id: SectionId;
  enabled: boolean;
  content?: Record<string, unknown>;
}

export interface SiteDraft {
  business?: DeepPartial<SiteConfig["business"]>;
  design?: DeepPartial<SiteConfig["design"]> & { paletteId?: string };
  sections?: DraftSection[];
  site?: { subdomain?: string };
  navigation?: DeepPartial<NonNullable<SiteConfig["navigation"]>>;
  seo?: DeepPartial<NonNullable<SiteConfig["seo"]>>;
  integrations?: DeepPartial<NonNullable<SiteConfig["integrations"]>>;
  ai?: DeepPartial<NonNullable<SiteConfig["ai"]>>;
  /** What the client changed by hand, so a new category does not overwrite it. */
  customized?: { design?: boolean; sections?: boolean };
}

export const PLACEHOLDER_NAME = "Nome do seu negócio";
export const PLACEHOLDER_SUBDOMAIN = "seu-site";

function placeholderContent(id: SectionId, name: string): Section["content"] {
  switch (id) {
    case "hero":
      return {
        title: name,
        subtitle: "Uma frase curta sobre o que você faz de melhor.",
        cta: { label: "Fale conosco", action: "whatsapp" },
      };
    case "sobre":
      return {
        title: "Nossa história",
        text: "Conte como o negócio começou, o que vocês fazem e por que os clientes voltam.",
      };
    case "servicos":
      return {
        title: "O que oferecemos",
        items: [
          { name: "Seu primeiro serviço", description: "Descreva em uma linha." },
          { name: "Seu segundo serviço", description: "Descreva em uma linha." },
          { name: "Seu terceiro serviço", description: "Descreva em uma linha." },
        ],
      };
    case "galeria":
      return { title: "Galeria", images: [] };
    case "depoimentos":
      return { title: "Depoimentos", items: [] };
    case "faq":
      return {
        title: "Perguntas frequentes",
        items: [
          {
            question: "Qual é a pergunta que seus clientes mais fazem?",
            answer: "Responda aqui, com as palavras que você usaria com um cliente.",
          },
        ],
      };
    case "cta-final":
      return {
        title: "Venha nos conhecer",
        subtitle: "Estamos esperando por você.",
        cta: { label: "Chamar no WhatsApp", action: "whatsapp" },
      };
    case "contato":
      return { title: "Onde estamos", showMap: true, showHours: true };
  }
}

/** Default section list for a category: every section, the recommended ones switched on. */
export function defaultSections(category: string | undefined): DraftSection[] {
  const preset = findCategory(category);
  return sectionIds.map((id) => ({
    id,
    enabled: id === "hero" || id === "contato" || preset.sections.includes(id),
  }));
}

/** Applies a category to the draft: template, palette, fonts and sections, unless customized. */
export function applyCategory(draft: SiteDraft, category: string): SiteDraft {
  const preset = findCategory(category);
  const palette = findPalette(preset.palettes[0]);
  const next: SiteDraft = { ...draft, business: { ...draft.business, category } };
  if (!draft.customized?.design && palette) {
    next.design = {
      ...draft.design,
      template: preset.template,
      paletteId: palette.id,
      colors: {
        primary: palette.primary,
        secondary: palette.secondary,
        background: palette.background,
        text: palette.text,
      },
      fonts: { ...preset.fonts },
    };
  }
  if (!draft.customized?.sections) {
    const current = new Map((draft.sections ?? []).map((section) => [section.id, section]));
    next.sections = defaultSections(category).map((section) => ({
      ...section,
      content: current.get(section.id)?.content,
    }));
  }
  return next;
}

function valid<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
}

function filled(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const isBlank = (value: unknown) => typeof value === "string" && value.trim() === "";

/**
 * Keeps only what the client actually answered, so empty fields keep showing the
 * placeholder: blank strings are dropped, and list items without their main text too.
 * An empty testimonials list stays empty (there is no placeholder testimonial).
 */
export function answeredContent(
  id: SectionId,
  content: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content ?? {})) {
    if (isBlank(value)) continue;
    if (Array.isArray(value)) {
      const items = value.filter((item) => {
        if (typeof item === "string") return !isBlank(item);
        const record = item as Record<string, unknown>;
        const main = record.name ?? record.question ?? record.text;
        return main !== undefined && !isBlank(main);
      });
      if (items.length || id === "depoimentos") result[key] = items;
      continue;
    }
    if (value && typeof value === "object") {
      const nested = Object.fromEntries(Object.entries(value).filter(([, v]) => !isBlank(v)));
      if (Object.keys(nested).length) result[key] = nested;
      continue;
    }
    result[key] = value;
  }
  return result;
}

/** Builds a valid SiteConfig from a draft, for the live preview. */
export function buildPreviewConfig(draft: SiteDraft): SiteConfig {
  const preset = findCategory(draft.business?.category);
  const palette = findPalette(draft.design?.paletteId) ?? findPalette(preset.palettes[0]);
  const name = filled(draft.business?.name)?.slice(0, 80) ?? PLACEHOLDER_NAME;
  const category = filled(draft.business?.category) ?? preset.label;
  const city = filled(draft.business?.contact?.address?.city);

  const colors = draft.design?.colors;
  const sections = (draft.sections?.length ? draft.sections : defaultSections(category)).map(
    (section): Section => {
      const fallback = {
        id: section.id,
        enabled: section.enabled,
        content: placeholderContent(section.id, name),
      };
      const merged = {
        ...fallback,
        content: { ...fallback.content, ...answeredContent(section.id, section.content) },
      };
      // Half-typed content (e.g. over the length limit) falls back to the placeholder.
      return valid(sectionSchema, merged, valid(sectionSchema, fallback, fallback as Section));
    },
  );

  const config = {
    schemaVersion: SCHEMA_VERSION,
    site: {
      type: "landing-page",
      language: "pt-BR",
      subdomain: valid(subdomainSchema, draft.site?.subdomain, PLACEHOLDER_SUBDOMAIN),
      customDomain: null,
    },
    business: {
      ...draft.business,
      name,
      category,
      contact: {
        ...draft.business?.contact,
        address: { ...draft.business?.contact?.address, city },
      },
    },
    design: {
      template: valid(
        siteConfigSchema.shape.design.shape.template,
        draft.design?.template,
        preset.template,
      ),
      colors: {
        primary: valid(hexColorSchema, colors?.primary, palette?.primary ?? "#2F5D50"),
        secondary: valid(hexColorSchema, colors?.secondary, palette?.secondary ?? "#1F3B33"),
        background: valid(hexColorSchema, colors?.background, palette?.background ?? "#FBFBF8"),
        text: valid(hexColorSchema, colors?.text, palette?.text ?? "#1A1A1A"),
      },
      fonts: {
        heading:
          headingFonts.find((f) => f === draft.design?.fonts?.heading) ?? preset.fonts.heading,
        body: bodyFonts.find((f) => f === draft.design?.fonts?.body) ?? preset.fonts.body,
      },
      style: draft.design?.style,
    },
    navigation: { sticky: true, ctaLabel: "Fale conosco", ...draft.navigation },
    sections,
    seo: draft.seo,
    integrations: { whatsappFloatingButton: true, googleMapsEmbed: true, ...draft.integrations },
    ai: draft.ai,
  };

  // Anything still invalid in the optional blocks (contact, seo...) is dropped field by field.
  const result = siteConfigSchema.safeParse(config);
  if (result.success) return result.data;
  const cleaned = structuredClone(config) as Record<string, unknown>;
  for (const issue of result.error.issues) removePath(cleaned, issue.path);
  return siteConfigSchema.parse(cleaned);
}

function removePath(target: Record<string, unknown>, path: PropertyKey[]): void {
  const parent = path
    .slice(0, -1)
    .reduce<unknown>(
      (node, key) => (node as Record<PropertyKey, unknown> | undefined)?.[key],
      target,
    ) as Record<PropertyKey, unknown> | undefined;
  const key = path.at(-1);
  if (parent && key !== undefined) delete parent[key];
}
