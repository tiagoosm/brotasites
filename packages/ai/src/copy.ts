import {
  categoryInfo,
  familyInfo,
  type OpeningHours,
  type Section,
  type SectionId,
  type SiteConfig,
} from "@brotasites/schema/v1.2";
import { z } from "zod";

// The copy step (docs/ai-and-reviewer.md, Copy). The AI rewrites the text of a 1.2 config:
// titles, the about text, service descriptions, steps, highlights, FAQ, the final call, SEO.
// Facts never come from it: names of services, prices, icons, photos, contacts and hours stay
// as the client gave them, testimonials are never touched, and fields the client edited by
// hand (`ai.userEditedFields`) are kept. The answer schema is built from the site's sections.

const text = (max: number) => z.string().trim().max(max);
const line = (max: number) => z.string().trim().min(1).max(max);

function enabledSection<Id extends SectionId>(config: SiteConfig, id: Id) {
  return config.sections.find((item) => item.id === id && item.enabled) as
    | Extract<Section, { id: Id }>
    | undefined;
}

export function copySchema(config: SiteConfig) {
  const shape: Record<string, z.ZodType> = {
    hero: z.strictObject({ title: line(80), subtitle: text(200), ctaLabel: line(30) }),
    seo: z.strictObject({
      title: line(70),
      description: text(160),
      keywords: z.array(line(40)).max(10),
    }),
    navigation: z.strictObject({ ctaLabel: line(30) }),
  };
  const sobre = enabledSection(config, "sobre");
  if (sobre) shape.sobre = z.strictObject({ title: line(60), text: text(800) });
  const servicos = enabledSection(config, "servicos");
  if (servicos) {
    shape.servicos = z.strictObject({
      title: line(60),
      items: z
        .array(z.strictObject({ description: text(200) }))
        .length(servicos.content.items.length),
    });
  }
  const steps = enabledSection(config, "como-funciona");
  if (steps) {
    shape["como-funciona"] = z.strictObject({
      title: line(60),
      steps: z
        .array(z.strictObject({ title: line(60), text: text(200) }))
        .length(steps.content.steps.length),
    });
  }
  const highlights = enabledSection(config, "diferenciais");
  if (highlights) {
    shape.diferenciais = z.strictObject({
      title: line(60),
      items: z
        .array(z.strictObject({ title: line(60), text: text(200) }))
        .length(highlights.content.items.length),
    });
  }
  const faq = enabledSection(config, "faq");
  if (faq) {
    shape.faq = z.strictObject({
      title: line(60),
      items: z
        .array(z.strictObject({ question: line(120), answer: line(400) }))
        .length(faq.content.items.length),
    });
  }
  for (const id of ["galeria", "depoimentos", "contato"] as const) {
    if (enabledSection(config, id)) shape[id] = z.strictObject({ title: line(60) });
  }
  if (enabledSection(config, "cta-final")) {
    shape["cta-final"] = z.strictObject({
      title: line(80),
      subtitle: text(160),
      ctaLabel: line(30),
    });
  }
  return z.strictObject(shape);
}

export interface Copy {
  hero: { title: string; subtitle: string; ctaLabel: string };
  seo: { title: string; description: string; keywords: string[] };
  navigation: { ctaLabel: string };
  sobre?: { title: string; text: string };
  servicos?: { title: string; items: { description: string }[] };
  "como-funciona"?: { title: string; steps: { title: string; text: string }[] };
  diferenciais?: { title: string; items: { title: string; text: string }[] };
  faq?: { title: string; items: { question: string; answer: string }[] };
  galeria?: { title: string };
  depoimentos?: { title: string };
  contato?: { title: string };
  "cta-final"?: { title: string; subtitle: string; ctaLabel: string };
}

const dayNames: Record<string, string> = {
  mon: "seg",
  tue: "ter",
  wed: "qua",
  thu: "qui",
  fri: "sex",
  sat: "sáb",
  sun: "dom",
};

export function hoursText(hours: OpeningHours): string {
  if (hours.mode === "always") return "Aberto 24 horas";
  if (hours.mode === "byAppointment")
    return `Com hora marcada${hours.note ? `. ${hours.note}` : ""}`;
  const rules = hours.rules.map(
    (rule) =>
      `${rule.days.map((day) => dayNames[day]).join(", ")}: ${rule.intervals
        .map((interval) => `${interval.open}–${interval.close}`)
        .join(" e ")}`,
  );
  return [...rules, hours.note].filter(Boolean).join("; ");
}

/** What the copy step sends to the model, as data (delimited by the caller). */
export function copyInputFrom(config: SiteConfig) {
  const { business, brand, sections } = config;
  const hero = enabledSection(config, "hero")?.content;
  const sobre = enabledSection(config, "sobre")?.content;
  const servicos = enabledSection(config, "servicos")?.content;
  const highlights = enabledSection(config, "diferenciais")?.content;
  const finalCta = enabledSection(config, "cta-final")?.content;
  const titleOf = (id: "galeria" | "depoimentos" | "contato") => {
    const found = enabledSection(config, id);
    return found ? { title: found.content.title } : undefined;
  };
  return {
    business: {
      name: business.name,
      tagline: business.tagline,
      category: categoryInfo(business.category)?.label ?? business.category,
      family: familyInfo[business.family].label,
      description: business.description,
      foundedYear: business.foundedYear,
      street: business.address.street,
      number: business.address.number,
      district: business.address.district,
      city: business.address.city,
      state: business.address.state,
      serviceArea: business.serviceArea,
      hours: hoursText(business.openingHours),
      registration: business.registration
        ? `${business.registration.council} ${business.registration.number}`
        : undefined,
      contactChannels: (["whatsapp", "phone", "email"] as const).filter(
        (channel) => business.contact[channel],
      ),
    },
    feelings: brand.feelings,
    tone: config.ai.tone,
    sections: {
      hero: {
        title: hero?.title,
        subtitle: hero?.subtitle,
        ctaLabel: hero?.cta?.label,
        ctaAction: hero?.cta?.action,
      },
      sobre: sobre && { title: sobre.title, text: sobre.text },
      servicos: servicos && {
        title: servicos.title,
        items: servicos.items.map(({ name, description, price }) => ({ name, description, price })),
      },
      "como-funciona": enabledSection(config, "como-funciona")?.content,
      diferenciais: highlights && {
        title: highlights.title,
        items: highlights.items.map(({ title, text }) => ({ title, text })),
      },
      faq: enabledSection(config, "faq")?.content,
      galeria: titleOf("galeria"),
      depoimentos: titleOf("depoimentos"),
      contato: titleOf("contato"),
      "cta-final": finalCta && {
        title: finalCta.title,
        subtitle: finalCta.subtitle,
        ctaLabel: finalCta.cta.label,
        ctaAction: finalCta.cta.action,
      },
    },
    pageOrder: sections.filter((item) => item.enabled).map((item) => item.id),
    userEditedFields: config.ai.userEditedFields,
  };
}

export type CopyInput = ReturnType<typeof copyInputFrom>;

/** Every text value of the input, for the fact check. */
export function sourceTexts(input: CopyInput): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") out.push(value);
    else if (typeof value === "number") out.push(String(value));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(input.business);
  walk(input.sections);
  return out;
}

/** Facts that make a hero specific to this business. */
export function specificsOf(input: CopyInput): string[] {
  const { business } = input;
  const services = (input.sections.servicos?.items ?? []).map((item) => item.name);
  return [
    business.name,
    business.city,
    business.district,
    business.street,
    business.foundedYear ? String(business.foundedYear) : undefined,
    ...business.serviceArea,
    ...services,
  ].filter((item): item is string => Boolean(item));
}

/** The answer as flat config paths ("sections.sobre.content.text") with their text. */
export function copyFields(copy: Copy): Record<string, string> {
  const fields: Record<string, string> = {};
  const put = (path: string, value: string | undefined) => {
    if (value !== undefined) fields[path] = value;
  };
  put("sections.hero.content.title", copy.hero.title);
  put("sections.hero.content.subtitle", copy.hero.subtitle);
  put("sections.hero.content.cta.label", copy.hero.ctaLabel);
  put("seo.title", copy.seo.title);
  put("seo.description", copy.seo.description);
  copy.seo.keywords.forEach((keyword, index) => {
    put(`seo.keywords.${index}`, keyword);
  });
  put("navigation.ctaLabel", copy.navigation.ctaLabel);
  put("sections.sobre.content.title", copy.sobre?.title);
  put("sections.sobre.content.text", copy.sobre?.text);
  put("sections.servicos.content.title", copy.servicos?.title);
  copy.servicos?.items.forEach((item, index) => {
    put(`sections.servicos.content.items.${index}.description`, item.description);
  });
  put("sections.como-funciona.content.title", copy["como-funciona"]?.title);
  copy["como-funciona"]?.steps.forEach((step, index) => {
    put(`sections.como-funciona.content.steps.${index}.title`, step.title);
    put(`sections.como-funciona.content.steps.${index}.text`, step.text);
  });
  put("sections.diferenciais.content.title", copy.diferenciais?.title);
  copy.diferenciais?.items.forEach((item, index) => {
    put(`sections.diferenciais.content.items.${index}.title`, item.title);
    put(`sections.diferenciais.content.items.${index}.text`, item.text);
  });
  put("sections.faq.content.title", copy.faq?.title);
  copy.faq?.items.forEach((item, index) => {
    put(`sections.faq.content.items.${index}.question`, item.question);
    put(`sections.faq.content.items.${index}.answer`, item.answer);
  });
  for (const id of ["galeria", "depoimentos", "contato"] as const) {
    put(`sections.${id}.content.title`, copy[id]?.title);
  }
  put("sections.cta-final.content.title", copy["cta-final"]?.title);
  put("sections.cta-final.content.subtitle", copy["cta-final"]?.subtitle);
  put("sections.cta-final.content.cta.label", copy["cta-final"]?.ctaLabel);
  return fields;
}

export interface CopyMeta {
  promptVersion: string;
  playbookVersion: string;
  modelId: string;
}

/**
 * Writes the answer into the config. Paths in `ai.userEditedFields` (or under one of them) are
 * left as the client wrote them; the paths written go to `ai.generatedFields`.
 */
export function applyCopy(config: SiteConfig, copy: Copy, meta: CopyMeta): SiteConfig {
  const next = structuredClone(config);
  const edited = config.ai.userEditedFields;
  const isEdited = (path: string) =>
    edited.some((field) => path === field || path.startsWith(`${field}.`));
  const written: string[] = [];

  for (const [path, value] of Object.entries(copyFields(copy))) {
    if (isEdited(path) || path.startsWith("seo.keywords.")) continue;
    const parts = path.split(".");
    let target: Record<string, unknown> | undefined;
    let rest: string[];
    if (parts[0] === "sections") {
      const section = next.sections.find((item) => item.id === parts[1]);
      if (!section) continue;
      target = section as unknown as Record<string, unknown>;
      rest = parts.slice(2);
    } else {
      target = next as unknown as Record<string, unknown>;
      rest = parts;
    }
    const key = rest.pop() as string;
    for (const part of rest) {
      const child = (target as Record<string, unknown>)[part];
      if (!child || typeof child !== "object") {
        target = undefined;
        break;
      }
      target = child as Record<string, unknown>;
    }
    if (!target) continue;
    // Optional texts are left out rather than stored empty.
    if ((key === "subtitle" || key === "description") && value === "") {
      delete target[key];
    } else {
      target[key] = value;
    }
    written.push(path);
  }
  if (!isEdited("seo.keywords")) {
    next.seo.keywords = copy.seo.keywords;
    written.push("seo.keywords");
  }

  next.ai = {
    ...next.ai,
    generatedFields: [...new Set([...config.ai.generatedFields, ...written])].slice(0, 200),
    promptVersion: meta.promptVersion,
    playbookVersion: meta.playbookVersion,
    modelId: meta.modelId,
  };
  return next;
}

/** The text of a config in the answer's shape (what the copy step wrote, or the client did). */
export function copyFromConfig(config: SiteConfig): Copy {
  const hero = enabledSection(config, "hero")?.content;
  const copy: Copy = {
    hero: {
      title: hero?.title ?? "",
      subtitle: hero?.subtitle ?? "",
      ctaLabel: hero?.cta?.label ?? "",
    },
    seo: { ...config.seo },
    navigation: { ctaLabel: config.navigation.ctaLabel },
  };
  const sobre = enabledSection(config, "sobre")?.content;
  if (sobre) copy.sobre = { title: sobre.title, text: sobre.text };
  const servicos = enabledSection(config, "servicos")?.content;
  if (servicos) {
    copy.servicos = {
      title: servicos.title,
      items: servicos.items.map((item) => ({ description: item.description ?? "" })),
    };
  }
  const steps = enabledSection(config, "como-funciona")?.content;
  if (steps) copy["como-funciona"] = { title: steps.title, steps: steps.steps };
  const highlights = enabledSection(config, "diferenciais")?.content;
  if (highlights) {
    copy.diferenciais = {
      title: highlights.title,
      items: highlights.items.map((item) => ({ title: item.title, text: item.text ?? "" })),
    };
  }
  const faq = enabledSection(config, "faq")?.content;
  if (faq) copy.faq = { title: faq.title, items: faq.items };
  for (const id of ["galeria", "depoimentos", "contato"] as const) {
    const found = enabledSection(config, id);
    if (found) copy[id] = { title: found.content.title };
  }
  const finalCta = enabledSection(config, "cta-final")?.content;
  if (finalCta) {
    copy["cta-final"] = {
      title: finalCta.title,
      subtitle: finalCta.subtitle ?? "",
      ctaLabel: finalCta.cta.label,
    };
  }
  return copy;
}
