import { z } from "zod";
import { hexColorSchema, subdomainSchema, whatsappSchema } from "./primitives.js";
import { sectionSchema } from "./sections.js";

// Mirrors docs/site-config.schema.json (v1.1). Only the root object rejects unknown keys,
// as in the JSON schema; nested objects strip them.

export const SCHEMA_VERSION = "1.1";

export const templates = ["classico", "moderno", "minimalista", "vibrante"] as const;
export const headingFonts = [
  "Inter",
  "Playfair Display",
  "Poppins",
  "Montserrat",
  "Lora",
  "Roboto Slab",
] as const;
export const bodyFonts = ["Inter", "Poppins", "Montserrat", "Lora", "Roboto"] as const;
export const aiTones = ["amigavel", "profissional", "descontraido", "elegante"] as const;

const siteSchema = z.object({
  type: z.literal("landing-page"),
  language: z.string(),
  subdomain: subdomainSchema,
  customDomain: z.string().nullish(),
});

const addressSchema = z.object({
  street: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  zip: z.string().optional(),
});

const contactSchema = z.object({
  phone: z.string().optional(),
  whatsapp: whatsappSchema.optional(),
  email: z.email("E-mail inválido.").optional(),
  address: addressSchema.optional(),
  openingHours: z.array(z.object({ days: z.string(), hours: z.string() })).optional(),
});

const businessSchema = z.object({
  name: z.string().min(2).max(80),
  tagline: z.string().max(120).optional(),
  category: z.string(),
  description: z.string().max(500).optional(),
  logo: z.string().nullish(),
  contact: contactSchema,
  social: z
    .object({
      instagram: z.string().nullish(),
      facebook: z.string().nullish(),
    })
    .optional(),
});

const designSchema = z.object({
  template: z.enum(templates),
  colors: z.object({
    primary: hexColorSchema,
    secondary: hexColorSchema.optional(),
    background: hexColorSchema,
    text: hexColorSchema,
  }),
  fonts: z.object({
    heading: z.enum(headingFonts).optional(),
    body: z.enum(bodyFonts).optional(),
  }),
  style: z
    .object({
      borderRadius: z.enum(["none", "soft", "round"]).optional(),
      buttons: z.enum(["filled", "outline"]).optional(),
      darkMode: z.boolean().optional(),
    })
    .optional(),
});

const navigationSchema = z.object({
  sticky: z.boolean().optional(),
  ctaLabel: z.string().max(30).optional(),
});

const seoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(160).optional(),
  keywords: z.array(z.string()).optional(),
});

const integrationsSchema = z.object({
  whatsappFloatingButton: z.boolean().optional(),
  googleMapsEmbed: z.boolean().optional(),
  contactForm: z
    .object({
      provider: z.enum(["formspree", "web3forms"]).nullish(),
      endpoint: z.string().nullish(),
    })
    .optional(),
  analytics: z.string().nullish(),
});

const aiSchema = z.object({
  tone: z.enum(aiTones).optional(),
  generatedFields: z.array(z.string()).optional(),
  userEditedFields: z.array(z.string()).optional(),
});

export const siteConfigSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  site: siteSchema,
  business: businessSchema,
  design: designSchema,
  navigation: navigationSchema.optional(),
  sections: z.array(sectionSchema).min(1),
  seo: seoSchema.optional(),
  integrations: integrationsSchema.optional(),
  ai: aiSchema.optional(),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type Template = (typeof templates)[number];
export type HeadingFont = (typeof headingFonts)[number];
export type BodyFont = (typeof bodyFonts)[number];
export type AiTone = (typeof aiTones)[number];
