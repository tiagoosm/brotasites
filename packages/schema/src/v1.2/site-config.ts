import { z } from "zod";
import { contrastRatio } from "../color.js";
import { openingHoursSchema } from "./hours.js";
import {
  assetIdSchema,
  catalogIdSchema,
  customDomainSchema,
  emailSchema,
  facebookSchema,
  hexColorSchema,
  instagramSchema,
  phoneSchema,
  stateSchema,
  subdomainSchema,
  whatsappSchema,
  zipSchema,
} from "./primitives.js";
import { type Section, sectionsSchema } from "./sections.js";
import { categoryIds, categoryInfo, families, familyInfo, sectionIds } from "./taxonomy.js";

// The site configuration, schema 1.2 (docs/schema-1.2.md). Single source of truth for the
// form, API, AI, engine and generator. Rules that tie fields together live in the final
// superRefine, so each one reports the field the client has to fix.

const AA = 4.5;

export const siteSchema = z.strictObject({
  type: z.literal("landing-page"),
  language: z.literal("pt-BR"),
  timezone: z
    .string()
    .regex(/^America\/[A-Za-z_]+$/)
    .default("America/Sao_Paulo"),
  subdomain: subdomainSchema,
  customDomain: customDomainSchema.nullable(),
});

export const contactSchema = z.strictObject({
  phone: phoneSchema.optional(),
  whatsapp: whatsappSchema.optional(),
  email: emailSchema.optional(),
});

export const addressSchema = z.strictObject({
  hasFixedAddress: z.boolean(),
  street: z.string().trim().min(1).max(120).optional(),
  number: z.string().trim().min(1).max(20).optional(),
  district: z.string().trim().min(1).max(80).optional(),
  // Step 1 of the form always asks for the city and state, with or without a fixed address.
  city: z.string().trim().min(2).max(80),
  state: stateSchema,
  zip: zipSchema.optional(),
});

export const registrationSchema = z.strictObject({
  council: z.string().trim().min(2).max(20),
  number: z.string().trim().min(1).max(30),
});

export const businessSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(120).optional(),
  category: z.enum(categoryIds as [string, ...string[]], "Escolha o tipo de negócio."),
  family: z.enum(families),
  description: z.string().trim().max(500),
  foundedYear: z
    .int()
    .min(1900)
    .refine((year) => year <= new Date().getFullYear(), "O ano não pode estar no futuro.")
    .optional(),
  contact: contactSchema,
  address: addressSchema,
  serviceArea: z.array(z.string().trim().min(2).max(60)).max(10),
  openingHours: openingHoursSchema,
  social: z.strictObject({
    instagram: instagramSchema.optional(),
    facebook: facebookSchema.optional(),
  }),
  registration: registrationSchema.optional(),
});

export const feelings = ["acolhedor", "elegante", "moderno", "robusto", "ousado"] as const;
export type Feeling = (typeof feelings)[number];

export const brandSchema = z.strictObject({
  logoAsset: assetIdSchema.nullable(),
  brandColors: z.array(hexColorSchema).max(3),
  feelings: z
    .array(z.enum(feelings))
    .max(2, "Escolha até 2 sensações.")
    .refine((list) => new Set(list).size === list.length, "Cada sensação só uma vez."),
});

/** The 5 personalities of docs/art-direction.md; the feelings use the same words. */
export const personalities = feelings;

export const paletteRoles = [
  "background",
  "surface",
  "text",
  "textMuted",
  "primary",
  "onPrimary",
  "accent",
] as const;
export type PaletteRole = (typeof paletteRoles)[number];
export type Palette = Record<PaletteRole, string>;

/** Pairs that must reach WCAG AA (4.5:1) as [foreground, background]. */
export const contrastPairs: readonly [PaletteRole, PaletteRole][] = [
  ["text", "background"],
  ["textMuted", "background"],
  ["text", "surface"],
  ["onPrimary", "primary"],
];

export function contrastIssues(palette: Palette): [PaletteRole, PaletteRole][] {
  return contrastPairs.filter(([fg, bg]) => contrastRatio(palette[fg], palette[bg]) < AA);
}

export const paletteSchema = z.strictObject(
  Object.fromEntries(paletteRoles.map((role) => [role, hexColorSchema])) as Record<
    PaletteRole,
    typeof hexColorSchema
  >,
);

/** Identity fields, in the order the engine fills them. */
export const identityFields = [
  "personality",
  "heroVariant",
  "fontPair",
  "typeScale",
  "palette",
  "shape",
  "ornamentSet",
  "pattern",
  "imageTreatment",
  "dividerStyle",
  "markStyle",
  "sectionVariants",
  "rhythm",
  "motionPreset",
] as const;
export type IdentityField = (typeof identityFields)[number];

/** Fields that approving a direction must lock (docs/schema-1.2.md). */
export const requiredLocks: readonly IdentityField[] = [
  "personality",
  "heroVariant",
  "sectionVariants",
  "motionPreset",
  "markStyle",
];

export const identitySchema = z.strictObject({
  personality: z.enum(personalities),
  heroVariant: catalogIdSchema,
  fontPair: catalogIdSchema,
  typeScale: catalogIdSchema,
  palette: paletteSchema,
  shape: catalogIdSchema,
  ornamentSet: catalogIdSchema,
  pattern: catalogIdSchema,
  imageTreatment: catalogIdSchema,
  dividerStyle: catalogIdSchema,
  markStyle: catalogIdSchema,
  sectionVariants: z.partialRecord(z.enum(sectionIds), catalogIdSchema),
  rhythm: catalogIdSchema,
  motionPreset: catalogIdSchema,
  fingerprint: z.string().regex(/^[0-9a-f]{16,64}$/),
});

export const designSchema = z.strictObject({
  seed: z.string().min(1).max(128),
  round: z.int().min(0),
  // Null until the engine has produced the directions.
  identity: identitySchema.nullable(),
  directionStatus: z.enum(["draft", "approved"]),
  approvedDirectionId: z.string().min(1).max(64).nullable(),
  lockedFields: z
    .array(z.enum(identityFields))
    .refine((list) => new Set(list).size === list.length),
  // Editable after approval. Font pairs are checked against the catalog when it exists (E3).
  overrides: z.strictObject({
    colors: paletteSchema.partial().optional(),
    fontPair: catalogIdSchema.optional(),
  }),
});

export const navigationSchema = z.strictObject({
  sticky: z.boolean(),
  ctaLabel: z.string().trim().min(1).max(30),
});

export const seoSchema = z.strictObject({
  title: z.string().trim().min(1).max(70),
  description: z.string().trim().max(160),
  keywords: z.array(z.string().trim().min(1).max(40)).max(10),
});

export const integrationsSchema = z.strictObject({
  whatsappFloatingButton: z.boolean(),
});

/** Dotted paths into this config ("sections.sobre.content.text"). */
const fieldPathSchema = z.string().regex(/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/);

export const aiSchema = z.strictObject({
  tone: z.string().trim().max(40).nullable(),
  generatedFields: z.array(fieldPathSchema).max(200),
  // Fields the client edited by hand: the AI never overwrites them.
  userEditedFields: z.array(fieldPathSchema).max(200),
  promptVersion: z.string().max(40).nullable(),
  playbookVersion: z.string().max(40).nullable(),
  modelId: z.string().max(80).nullable(),
});

export const reviewSchema = z.strictObject({
  status: z.enum(["notReviewed", "passed", "changesNeeded", "needsAttention"]),
  reviewerReportId: z.uuid().nullable(),
  humanDecision: z.enum(["approved", "changesRequested", "suspended"]).nullable(),
});

function enabled(sections: readonly Section[], id: Section["id"]): Section | undefined {
  return sections.find((item) => item.id === id && item.enabled);
}

export const siteConfigSchema = z
  .strictObject({
    schemaVersion: z.literal("1.2"),
    site: siteSchema,
    business: businessSchema,
    brand: brandSchema,
    design: designSchema,
    sections: sectionsSchema,
    navigation: navigationSchema,
    seo: seoSchema,
    integrations: integrationsSchema,
    ai: aiSchema,
    review: reviewSchema,
  })
  .superRefine((config, ctx) => {
    const { business, design, sections } = config;
    const { contact, address } = business;
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    // Contact and address.
    if (!contact.phone && !contact.whatsapp && !contact.email) {
      issue(
        ["business", "contact"],
        "Informe pelo menos um contato: WhatsApp, telefone ou e-mail.",
      );
    }
    if (address.hasFixedAddress && !address.street) {
      issue(["business", "address", "street"], "Informe a rua do endereço.");
    }
    if (!address.hasFixedAddress) {
      if (business.serviceArea.length === 0) {
        issue(["business", "serviceArea"], "Informe os bairros ou cidades que você atende.");
      }
      if (address.street || address.number || address.zip) {
        issue(["business", "address"], "Sem endereço fixo, deixe rua, número e CEP em branco.");
      }
    }

    // Category and family.
    const category = categoryInfo(business.category);
    if (category && category.family !== business.family) {
      issue(["business", "family"], "A família não corresponde à categoria escolhida.");
    }
    if (familyInfo[business.family].requiresRegistration && !business.registration) {
      issue(["business", "registration"], "Informe o registro profissional (conselho e número).");
    }
    if (business.category === "psicologia" && enabled(sections, "depoimentos")) {
      issue(["sections"], "Depoimentos não podem ser usados em psicologia.");
    }

    // Buttons need the channel they open.
    const channels = {
      whatsapp: Boolean(contact.whatsapp),
      phone: Boolean(contact.phone),
      email: Boolean(contact.email),
      directions: address.hasFixedAddress,
      section: true,
    };
    sections.forEach((item, index) => {
      const cta = item.id === "hero" || item.id === "cta-final" ? item.content.cta : undefined;
      if (cta && !channels[cta.action]) {
        issue(
          ["sections", index, "content", "cta", "action"],
          "Este botão precisa do contato correspondente.",
        );
      }
      if (item.id === "contato" && item.content.showMapLink && !address.hasFixedAddress) {
        issue(
          ["sections", index, "content", "showMapLink"],
          '"Como chegar" precisa de endereço fixo.',
        );
      }
    });
    if (config.integrations.whatsappFloatingButton && !contact.whatsapp) {
      issue(["integrations", "whatsappFloatingButton"], "O botão flutuante precisa do WhatsApp.");
    }

    // Identity: AA contrast on the palette and on the client's color overrides.
    if (design.identity) {
      for (const [fg, bg] of contrastIssues(design.identity.palette)) {
        issue(["design", "identity", "palette", fg], `Contraste insuficiente entre ${fg} e ${bg}.`);
      }
      const colors = design.overrides.colors;
      if (colors && Object.keys(colors).length > 0) {
        for (const [fg, bg] of contrastIssues({ ...design.identity.palette, ...colors })) {
          issue(["design", "overrides", "colors"], `Contraste insuficiente entre ${fg} e ${bg}.`);
        }
      }
    } else if (design.overrides.colors || design.overrides.fontPair) {
      issue(["design", "overrides"], "Ajustes só valem depois de escolher uma direção.");
    }

    // Approval locks the identity.
    if (design.directionStatus === "approved") {
      if (!design.identity || !design.approvedDirectionId) {
        issue(["design", "approvedDirectionId"], "Uma direção aprovada precisa de identidade.");
      }
      const missing = requiredLocks.filter((field) => !design.lockedFields.includes(field));
      if (missing.length > 0) {
        issue(["design", "lockedFields"], `Faltam travas: ${missing.join(", ")}.`);
      }
    } else if (design.approvedDirectionId) {
      issue(["design", "approvedDirectionId"], "Só uma direção aprovada tem identificador.");
    }
  });

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type SiteConfigInput = z.input<typeof siteConfigSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type Business = z.infer<typeof businessSchema>;

/** Parses unknown input; on failure returns the issues with their paths. */
export function parseSiteConfig(input: unknown) {
  return siteConfigSchema.safeParse(input);
}
