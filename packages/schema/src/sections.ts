import { z } from "zod";
import { ctaSchema } from "./primitives.js";

export const heroContentSchema = z.object({
  title: z.string().max(80),
  subtitle: z.string().max(200).optional(),
  image: z.string().nullish(),
  cta: ctaSchema.optional(),
});

export const aboutContentSchema = z.object({
  title: z.string().max(60),
  text: z.string().max(800),
  image: z.string().nullish(),
});

export const servicesContentSchema = z.object({
  title: z.string().max(60),
  items: z
    .array(
      z.object({
        name: z.string().max(50),
        description: z.string().max(200).optional(),
        icon: z.string().nullish(),
      }),
    )
    .min(1)
    .max(9),
});

export const galleryContentSchema = z.object({
  title: z.string().max(60),
  images: z.array(z.string()).max(12),
});

export const testimonialsContentSchema = z.object({
  title: z.string().max(60),
  items: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        text: z.string().max(300),
      }),
    )
    .max(6),
});

export const faqContentSchema = z.object({
  title: z.string().max(60),
  items: z
    .array(
      z.object({
        question: z.string().max(120),
        answer: z.string().max(400),
      }),
    )
    .min(1)
    .max(10),
});

export const finalCtaContentSchema = z.object({
  title: z.string().max(80),
  subtitle: z.string().max(160).optional(),
  cta: ctaSchema,
});

export const contactContentSchema = z.object({
  title: z.string().max(60),
  showMap: z.boolean().optional(),
  showHours: z.boolean().optional(),
  showForm: z.boolean().optional(),
});

// Section ids are part of the JSON contract and stay in pt-BR.
export const sectionIds = [
  "hero",
  "sobre",
  "servicos",
  "galeria",
  "depoimentos",
  "faq",
  "cta-final",
  "contato",
] as const;

export const heroSectionSchema = z.object({
  id: z.literal("hero"),
  enabled: z.boolean(),
  content: heroContentSchema,
});

export const aboutSectionSchema = z.object({
  id: z.literal("sobre"),
  enabled: z.boolean(),
  content: aboutContentSchema,
});

export const servicesSectionSchema = z.object({
  id: z.literal("servicos"),
  enabled: z.boolean(),
  content: servicesContentSchema,
});

export const gallerySectionSchema = z.object({
  id: z.literal("galeria"),
  enabled: z.boolean(),
  content: galleryContentSchema,
});

// Rule added in the Zod schema (not in the v1.1 JSON schema): the AI must never invent
// testimonials, so the section can only be enabled with at least one real testimonial.
export const testimonialsSectionSchema = z
  .object({
    id: z.literal("depoimentos"),
    enabled: z.boolean(),
    content: testimonialsContentSchema,
  })
  .refine((section) => !section.enabled || section.content.items.length > 0, {
    path: ["content", "items"],
    error: "Para ligar a seção de depoimentos, cadastre pelo menos um depoimento real.",
  });

export const faqSectionSchema = z.object({
  id: z.literal("faq"),
  enabled: z.boolean(),
  content: faqContentSchema,
});

export const finalCtaSectionSchema = z.object({
  id: z.literal("cta-final"),
  enabled: z.boolean(),
  content: finalCtaContentSchema,
});

export const contactSectionSchema = z.object({
  id: z.literal("contato"),
  enabled: z.boolean(),
  content: contactContentSchema,
});

export const sectionSchema = z.discriminatedUnion("id", [
  heroSectionSchema,
  aboutSectionSchema,
  servicesSectionSchema,
  gallerySectionSchema,
  testimonialsSectionSchema,
  faqSectionSchema,
  finalCtaSectionSchema,
  contactSectionSchema,
]);

export type SectionId = (typeof sectionIds)[number];
export type Section = z.infer<typeof sectionSchema>;
export type HeroContent = z.infer<typeof heroContentSchema>;
export type AboutContent = z.infer<typeof aboutContentSchema>;
export type ServicesContent = z.infer<typeof servicesContentSchema>;
export type GalleryContent = z.infer<typeof galleryContentSchema>;
export type TestimonialsContent = z.infer<typeof testimonialsContentSchema>;
export type FaqContent = z.infer<typeof faqContentSchema>;
export type FinalCtaContent = z.infer<typeof finalCtaContentSchema>;
export type ContactContent = z.infer<typeof contactContentSchema>;
