import { z } from "zod";
import { iconPaths } from "../icons.js";
import { imageSchema } from "./primitives.js";
import { type SectionId, sectionIds } from "./taxonomy.js";

// Sections of schema 1.2: `{ id, enabled, content }`, content validated per id. Section ids
// are part of the JSON contract and stay in pt-BR. Maximums always apply; minimums only when
// the section is enabled, so a client can switch a half-filled section off and keep its text.

/** Closed icon set until the catalog (E3) owns it: the icons the templates already ship. */
export const iconNames = Object.keys(iconPaths) as (keyof typeof iconPaths)[];
export const iconSchema = z.enum(
  iconNames as [keyof typeof iconPaths, ...(keyof typeof iconPaths)[]],
);

const title = z.string().trim().min(1).max(60);

/**
 * What a button does. The generator turns it into a wa.me, tel:, mailto: or "Como chegar" link
 * from the business contact, so no URL is ever stored here.
 */
export const ctaSchema = z.strictObject({
  label: z.string().trim().min(1).max(30),
  action: z.enum(["whatsapp", "phone", "email", "directions", "section"]),
  section: z.enum(sectionIds).optional(),
});

export const heroContentSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(200).optional(),
  image: imageSchema.nullable(),
  cta: ctaSchema.optional(),
});

export const aboutContentSchema = z.strictObject({
  title,
  text: z.string().trim().max(800),
  image: imageSchema.nullable(),
});

export const servicesContentSchema = z.strictObject({
  title,
  items: z
    .array(
      z.strictObject({
        name: z.string().trim().min(1).max(50),
        description: z.string().trim().max(200).optional(),
        price: z.string().trim().max(30).optional(),
        icon: iconSchema.optional(),
      }),
    )
    .max(9),
});

export const howItWorksContentSchema = z.strictObject({
  title,
  steps: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(60),
        text: z.string().trim().max(200),
      }),
    )
    .max(6),
});

export const highlightsContentSchema = z.strictObject({
  title,
  items: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(60),
        text: z.string().trim().max(200).optional(),
        icon: iconSchema,
      }),
    )
    .max(8),
});

export const galleryContentSchema = z.strictObject({
  title,
  images: z.array(imageSchema).max(12),
});

export const testimonialsContentSchema = z.strictObject({
  title,
  items: z
    .array(
      z.strictObject({
        name: z.string().trim().min(1).max(60),
        context: z.string().trim().max(60).optional(),
        text: z.string().trim().min(1).max(300),
        // Only real testimonials the author agreed to show; never written by the AI.
        authorized: z.literal(true, "Confirme que a pessoa autorizou o uso do depoimento."),
      }),
    )
    .max(6),
});

export const faqContentSchema = z.strictObject({
  title,
  items: z
    .array(
      z.strictObject({
        question: z.string().trim().min(1).max(120),
        answer: z.string().trim().min(1).max(400),
      }),
    )
    .max(10),
});

export const finalCtaContentSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(160).optional(),
  cta: ctaSchema,
});

export const contactContentSchema = z.strictObject({
  title,
  showHours: z.boolean(),
  showMapLink: z.boolean(),
});

type Counted = { [key: string]: unknown };

/** A section with its content; `minimum` names the list that must reach a size when enabled. */
function section<Id extends SectionId, Content extends z.ZodType<Counted>>(
  id: Id,
  content: Content,
  minimum?: { list: string; min: number; message: string },
) {
  return z
    .strictObject({ id: z.literal(id), enabled: z.boolean(), content })
    .superRefine((value, ctx) => {
      if (!minimum || !value.enabled) return;
      const list = (value as { content: Counted }).content[minimum.list];
      if (!Array.isArray(list) || list.length < minimum.min) {
        ctx.addIssue({
          code: "custom",
          path: ["content", minimum.list],
          message: minimum.message,
        });
      }
    });
}

export const sectionSchema = z.discriminatedUnion("id", [
  section("hero", heroContentSchema),
  section("sobre", aboutContentSchema),
  section("servicos", servicesContentSchema, {
    list: "items",
    min: 1,
    message: "Inclua pelo menos um serviço.",
  }),
  section("como-funciona", howItWorksContentSchema, {
    list: "steps",
    min: 2,
    message: "Use de 2 a 6 passos.",
  }),
  section("diferenciais", highlightsContentSchema, {
    list: "items",
    min: 3,
    message: "Use de 3 a 8 diferenciais.",
  }),
  section("galeria", galleryContentSchema, {
    list: "images",
    min: 1,
    message: "Inclua pelo menos uma foto.",
  }),
  section("depoimentos", testimonialsContentSchema, {
    list: "items",
    min: 1,
    message: "Depoimentos só aparecem com pelo menos um depoimento real e autorizado.",
  }),
  section("faq", faqContentSchema, {
    list: "items",
    min: 1,
    message: "Inclua pelo menos uma pergunta.",
  }),
  section("cta-final", finalCtaContentSchema),
  section("contato", contactContentSchema),
]);

export type Section = z.infer<typeof sectionSchema>;
export type Cta = z.infer<typeof ctaSchema>;

/** The list of sections in page order: each id once, the hero first and enabled. */
export const sectionsSchema = z
  .array(sectionSchema)
  .min(1)
  .max(sectionIds.length)
  .superRefine((sections, ctx) => {
    const ids = sections.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Cada seção só pode aparecer uma vez." });
    }
    const first = sections[0];
    if (first?.id !== "hero" || !first.enabled) {
      ctx.addIssue({
        code: "custom",
        path: [0],
        message: "O site começa pela seção de abertura.",
      });
    }
    sections.forEach((item, index) => {
      const cta = item.id === "hero" || item.id === "cta-final" ? item.content.cta : undefined;
      if (cta?.action === "section" && !cta.section) {
        ctx.addIssue({
          code: "custom",
          path: [index, "content", "cta", "section"],
          message: "Escolha para qual seção o botão leva.",
        });
      }
    });
  });
