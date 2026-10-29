import { z } from "zod";
import { type OpeningHours, openingHoursSchema } from "./hours.js";
import {
  assetIdSchema,
  cleanText,
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
import { type Cta, iconNames } from "./sections.js";
import { feelings, type Identity, type SiteConfigInput } from "./site-config.js";
import {
  categoryIds,
  categoryInfo,
  type Family,
  familyInfo,
  type SectionId,
  sectionIds,
} from "./taxonomy.js";

// The 7-step form of docs/form-flow.md and how its answers become a 1.2 config. The draft is
// saved at every step, so every field is optional here; each step checks its own answers with
// the step schemas, and `missingToGenerate` checks the minimum before the client sends them.
// Messages are user-facing (pt-BR).

export const formSteps12 = [
  {
    slug: "negocio",
    title: "Seu negócio",
    question: "Qual é o seu negócio?",
    description:
      "O básico primeiro. Quanto mais detalhe de verdade, mais o site fica com a sua cara.",
  },
  {
    slug: "marca",
    title: "Marca e sensação",
    question: "Como você quer que o seu negócio pareça?",
    description: "Logo e cores são opcionais. Sem logo, a gente cria um monograma com o seu nome.",
  },
  {
    slug: "secoes",
    title: "Seções",
    question: "O que o seu site vai mostrar?",
    description: "Já deixamos ligadas as seções que mais funcionam para o seu tipo de negócio.",
  },
  {
    slug: "conteudo",
    title: "Conteúdo",
    question: "O que você oferece?",
    description:
      "Serviços, diferenciais, perguntas e fotos. Escreva do seu jeito: a gente arruma o texto.",
  },
  {
    slug: "contato",
    title: "Contato",
    question: "Como os clientes falam com você?",
    description: "Pelo menos um canal: WhatsApp, telefone ou e-mail.",
  },
  {
    slug: "direcao",
    title: "Direção",
    question: "Pronto para ver as 3 direções?",
    description:
      'Envie as respostas e pode fechar a página. Avisamos no seu painel quando ficarem prontas.',
  },
  {
    slug: "endereco",
    title: "Endereço e revisão",
    question: "Onde o seu site vai morar?",
    description: "Escolha o endereço, confira o site pronto e aprove.",
  },
] as const;

export type FormStepSlug12 = (typeof formSteps12)[number]["slug"];

/** The questions that make a site specific (docs/form-flow.md, step 1). */
export const storyQuestions = [
  ["origin", "Como o negócio começou?"],
  ["unique", "O que só vocês fazem?"],
  ["praise", "O que os clientes mais elogiam?"],
  ["place", "Algum detalhe do bairro ou da cidade?"],
  ["bestseller", "O que é mais pedido?"],
] as const;
export type StoryKey = (typeof storyQuestions)[number][0];

const text = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `Use até ${max} caracteres.`);

export const photoAnswerSchema = z.object({
  assetId: assetIdSchema,
  alt: text(160),
  use: z.enum(["hero", "sobre", "galeria"]).optional(),
  showsPeople: z.boolean().optional(),
  peopleConsent: z.boolean().optional(),
  showsMinor: z.boolean().optional(),
  minorConsent: z.boolean().optional(),
});
export type PhotoAnswer = z.infer<typeof photoAnswerSchema>;

export const businessAnswersSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do negócio.").max(80, "Use até 80 caracteres."),
  category: z.enum(categoryIds as [string, ...string[]], "Escolha o tipo de negócio."),
  city: z.string().trim().min(2, "Informe a cidade.").max(80, "Use até 80 caracteres."),
  state: stateSchema,
  description: text(500, "Use até 500 caracteres."),
  foundedYear: z
    .int("Use só números.")
    .min(1900, "Confira o ano.")
    .refine((year) => year <= new Date().getFullYear(), "O ano não pode estar no futuro.")
    .optional(),
  story: z
    .partialRecord(
      z.enum(storyQuestions.map(([key]) => key) as [StoryKey, ...StoryKey[]]),
      text(200),
    )
    .optional(),
});

export const brandAnswersSchema = z.object({
  logoAsset: assetIdSchema.nullable(),
  brandColors: z.array(hexColorSchema).max(3, "Escolha até 3 cores."),
  feelings: z
    .array(z.enum(feelings))
    .max(2, "Escolha até 2 sensações.")
    .refine((list) => new Set(list).size === list.length, "Cada sensação só uma vez."),
});

export const contentAnswersSchema = z
  .object({
    services: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, "Dê um nome ao serviço.")
            .max(50, "Use até 50 caracteres."),
          description: text(200).optional(),
          price: text(30).optional(),
        }),
      )
      .max(9, "Use até 9 serviços."),
    highlights: z
      .array(
        z.object({
          title: z
            .string()
            .trim()
            .min(1, "Dê um título ao diferencial.")
            .max(60, "Use até 60 caracteres."),
          text: text(200).optional(),
        }),
      )
      .max(8, "Use até 8 diferenciais."),
    faq: z
      .array(
        z.object({
          question: z
            .string()
            .trim()
            .min(1, "Escreva a pergunta.")
            .max(120, "Use até 120 caracteres."),
          answer: z
            .string()
            .trim()
            .min(1, "Escreva a resposta da pergunta.")
            .max(400, "Use até 400 caracteres."),
        }),
      )
      .max(10, "Use até 10 perguntas."),
    testimonials: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, "Informe o nome de quem deu o depoimento.")
            .max(60, "Use até 60 caracteres."),
          context: text(60).optional(),
          text: z
            .string()
            .trim()
            .min(1, "Escreva o depoimento.")
            .max(300, "Use até 300 caracteres."),
          authorized: z.literal(true, "Confirme que a pessoa autorizou o uso do depoimento."),
        }),
      )
      .max(6, "Use até 6 depoimentos."),
    photos: z.array(photoAnswerSchema).max(12, "Use até 12 fotos."),
  })
  .superRefine((content, ctx) => {
    content.photos.forEach((photo, index) => {
      if (photo.showsPeople && !photo.peopleConsent) {
        ctx.addIssue({
          code: "custom",
          path: ["photos", index, "peopleConsent"],
          message: "Confirme que as pessoas da foto autorizaram o uso.",
        });
      }
      if (photo.showsMinor && !photo.minorConsent) {
        ctx.addIssue({
          code: "custom",
          path: ["photos", index, "minorConsent"],
          message: "Confirme que os responsáveis autorizaram o uso da foto.",
        });
      }
    });
  });

export const contactAnswersSchema = z
  .object({
    whatsapp: whatsappSchema.optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    hasFixedAddress: z.boolean(),
    street: text(120).optional(),
    number: text(20).optional(),
    district: text(80).optional(),
    zip: zipSchema.optional(),
    serviceArea: z
      .array(
        z
          .string()
          .trim()
          .min(2, "Escreva o nome do bairro ou da cidade.")
          .max(60, "Use até 60 caracteres por bairro ou cidade."),
      )
      .max(10, "Use até 10 bairros ou cidades."),
    openingHours: openingHoursSchema,
    instagram: instagramSchema.optional(),
    facebook: facebookSchema.optional(),
    registration: z
      .object({
        council: z
          .string()
          .trim()
          .min(2, "Informe o conselho, como CRP ou CRO.")
          .max(20, "Use até 20 caracteres."),
        number: z
          .string()
          .trim()
          .min(1, "Informe o número do registro.")
          .max(30, "Use até 30 caracteres."),
      })
      .optional(),
  })
  .superRefine((contact, ctx) => {
    if (!contact.whatsapp && !contact.phone && !contact.email) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message: "Informe pelo menos um contato: WhatsApp, telefone ou e-mail.",
      });
    }
    if (contact.hasFixedAddress && !contact.street) {
      ctx.addIssue({ code: "custom", path: ["street"], message: "Informe a rua do endereço." });
    }
    if (!contact.hasFixedAddress && contact.serviceArea.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["serviceArea"],
        message: "Informe os bairros ou cidades que você atende.",
      });
    }
  });

/** Everything the form saved so far. Each part is checked by its step's schema when completed. */
export interface FormDraft {
  business?: Partial<z.input<typeof businessAnswersSchema>>;
  brand?: Partial<z.input<typeof brandAnswersSchema>>;
  /** Sections after the hero the client left on; the family's defaults until they choose. */
  sections?: SectionId[];
  content?: Partial<z.input<typeof contentAnswersSchema>>;
  contact?: Partial<z.input<typeof contactAnswersSchema>>;
  site?: { subdomain?: string };
  /**
   * Colors the client changes after approving a direction (the identity stays locked). The
   * build keeps them only with AA contrast, pulling them to the nearest passing tone if needed.
   */
  colorOverrides?: Partial<Record<"primary" | "accent", string>>;
}

/** Loose check of a stored draft: shape only, so an old or partial draft still opens. */
export const formDraftSchema = z
  .object({
    business: z.record(z.string(), z.unknown()).optional(),
    brand: z.record(z.string(), z.unknown()).optional(),
    sections: z.array(z.enum(sectionIds)).optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    contact: z.record(z.string(), z.unknown()).optional(),
    site: z.object({ subdomain: subdomainSchema.optional() }).optional(),
    colorOverrides: z
      .object({ primary: hexColorSchema.optional(), accent: hexColorSchema.optional() })
      .optional(),
  })
  .loose();

// Blocked topics (docs/categories.md): the form stops here, kindly, and charges nothing. The
// category list never offers them; this catches them in names and descriptions ("Outro").
const blockedTopics: [RegExp, string][] = [
  [
    /\b(apostas?|bets?|cassinos?|jogo do bicho|ca[cç]a-n[ií]queis?|bingo)\b/i,
    "apostas e jogos de azar",
  ],
  [
    /\b(conte[uú]do adulto|acompanhantes?|sex ?shop|er[oó]tic[oa]s?|programas? adultos?)\b/i,
    "conteúdo adulto",
  ],
  [/\b(armas?( de fogo)?|muni[cç][aã]o|muni[cç][oõ]es)\b/i, "venda de armas e munição"],
  [
    /\b(cigarros? eletr[oô]nicos?|vapes?|pods? descart[aá]veis|tabacaria|narguil[eé])\b/i,
    "cigarro eletrônico e tabaco",
  ],
  [
    /\b(pir[aâ]mide|renda garantida|ganhos? garantidos?|investimentos? milagros[oa]s?|marketing multin[ií]vel|criptomoedas?)\b/i,
    "promessas de dinheiro fácil",
  ],
  [
    /\b(empr[eé]stimos?|consignados?|limpa ?nome|cobran[cç]as? de d[ií]vidas?|cr[eé]dito f[aá]cil)\b/i,
    "empréstimos e cobrança",
  ],
  [/\b(fique rico|enrique[cç]a|dinheiro r[aá]pido)\b/i, "cursos de enriquecimento rápido"],
  [
    /\b(r[eé]plicas?|falsifica[cç][aã]o|falsificad[oa]s?|primeira linha)\b/i,
    "réplicas e falsificações",
  ],
  [
    /\b(seguidores|curtidas|venda de contas|avalia[cç][oõ]es falsas)\b/i,
    "venda de seguidores, contas ou avaliações",
  ],
  [/\b(campanha eleitoral|propaganda eleitoral|candidat[oa] a)\b/i, "propaganda eleitoral"],
  [
    /\b(rem[eé]dios? controlados?|farm[aá]cia online|anabolizantes?)\b/i,
    "medicamentos controlados",
  ],
  [/\b(suporte t[eé]cnico (da|do) (microsoft|apple|google|banco))\b/i, "imitação de empresas"],
];

/** A blocked topic in what the client wrote, or null. The label is shown to the client. */
export function blockedTopic(...texts: (string | undefined)[]): string | null {
  const joined = texts.filter(Boolean).join(" \n ");
  return blockedTopics.find(([pattern]) => pattern.test(joined))?.[1] ?? null;
}

/** Launch waves open now (docs/categories.md): wave 1 first. */
export const OPEN_LAUNCH_WAVE = 1;

/** Why a category cannot be served yet, or null. */
export function categoryNotOpen(categoryId: string | undefined): string | null {
  if (!categoryId) return null;
  const info = categoryInfo(categoryId);
  if (info && info.wave > OPEN_LAUNCH_WAVE) {
    return "Ainda não estamos atendendo esse tipo de negócio. Ele entra numa próxima etapa.";
  }
  return null;
}

export function familyOf(categoryId: string | undefined): Family | undefined {
  return categoryId ? categoryInfo(categoryId)?.family : undefined;
}

/** The sections after the hero: the client's choice, or the family's defaults. */
export function sectionsOf(draft: FormDraft): SectionId[] {
  if (draft.sections) return draft.sections.filter((id) => id !== "hero");
  const family = familyOf(draft.business?.category);
  const defaults = family ? familyInfo[family].defaultSections : ["servicos", "sobre", "contato"];
  return [...new Set([...defaults, "cta-final", "contato"] as SectionId[])].filter(
    (id) => id !== "hero",
  );
}

/** What is still missing before the answers can be sent (docs/form-flow.md, minimum). */
export function missingToGenerate(draft: FormDraft): string[] {
  const missing: string[] = [];
  const business = draft.business ?? {};
  const contact = draft.contact ?? {};
  if (!business.name?.trim()) missing.push("o nome do negócio");
  if (!business.category) missing.push("o tipo de negócio");
  if (!business.city?.trim() || !business.state) missing.push("a cidade e o estado");
  if (!contact.whatsapp && !contact.phone && !contact.email)
    missing.push("um contato (WhatsApp, telefone ou e-mail)");
  const services = (draft.content?.services ?? []).filter((item) => item?.name?.trim());
  if (services.length === 0 && (business.description?.trim().length ?? 0) < 60) {
    missing.push("um serviço ou uma descrição com pelo menos 60 caracteres");
  }
  const blocked = blockedTopic(business.name, business.description);
  if (blocked) missing.push(`um tipo de negócio que a gente atende (${blocked} não é aceito)`);
  return missing;
}

const ctaLabels: Record<Cta["action"], string> = {
  whatsapp: "Chamar no WhatsApp",
  phone: "Ligar",
  email: "Enviar e-mail",
  directions: "Como chegar",
  section: "Ver serviços",
};

function sentence(text: string): string {
  const clean = text.trim();
  return /[.!?…]$/.test(clean) ? clean : `${clean}.`;
}

export interface ToConfigOptions {
  identity?: Identity | null;
  approvedDirectionId?: string | null;
  round?: number;
  seed?: string;
  /** Asset ids that exist after cleaning; photos and logos not in the list are left out. */
  availableAssets?: ReadonlySet<string>;
}

/**
 * The answers as a 1.2 config, with the client's own words. Sections without content stay off
 * (docs/form-flow.md, Missing data); the AI copy step rewrites the text afterwards.
 */
export function formToSiteConfig(draft: FormDraft, options: ToConfigOptions = {}): SiteConfigInput {
  const business = draft.business ?? {};
  const brand = draft.brand ?? {};
  const content = draft.content ?? {};
  const contact = draft.contact ?? {};
  const category = business.category ?? "outro";
  const family = familyOf(category) ?? "professionals";
  const has = (assetId: string | null | undefined): assetId is string =>
    Boolean(assetId) &&
    (!options.availableAssets || options.availableAssets.has(assetId as string));
  const photos = (content.photos ?? []).filter(
    (photo) => has(photo.assetId) && (!photo.showsMinor || photo.minorConsent),
  );
  const image = (photo: PhotoAnswer | undefined) =>
    photo
      ? {
          assetId: photo.assetId,
          alt: cleanText(photo.alt || business.name || ""),
          ...(photo.showsMinor ? { showsMinor: true, minorConsent: true as const } : {}),
        }
      : null;
  const heroPhoto = photos.find((photo) => photo.use === "hero") ?? photos[0];
  const aboutPhoto = photos.find((photo) => photo.use === "sobre" && photo !== heroPhoto);
  const gallery = photos
    .filter((photo) => photo !== heroPhoto && photo !== aboutPhoto)
    .slice(0, 12);

  const action: Cta["action"] = contact.whatsapp ? "whatsapp" : contact.phone ? "phone" : "email";
  const cta: Cta = { label: ctaLabels[action], action };
  const story = storyQuestions
    .map(([key]) => business.story?.[key]?.trim())
    .filter((answer): answer is string => Boolean(answer))
    .map(sentence);
  const aboutText = [business.description?.trim() ? sentence(business.description) : "", ...story]
    .filter(Boolean)
    .join(" ")
    .slice(0, 800)
    .trim();
  const services = (content.services ?? []).filter((item) => item?.name?.trim()).slice(0, 9);
  const highlights = (content.highlights ?? []).filter((item) => item?.title?.trim()).slice(0, 8);
  const faq = (content.faq ?? [])
    .filter((item) => item?.question?.trim() && item?.answer?.trim())
    .slice(0, 10);
  const testimonials = (content.testimonials ?? [])
    .filter((item) => item?.authorized === true && item.text?.trim())
    .slice(0, 6);
  const wanted = new Set(sectionsOf(draft));
  const hours: OpeningHours = (contact.openingHours as OpeningHours | undefined) ?? {
    mode: "byAppointment",
    rules: [],
  };
  const fixed = Boolean(contact.hasFixedAddress && contact.street);
  const icons = iconNames.filter(
    (name) => !["instagram", "facebook", "phone", "mail", "chat", "menu"].includes(name),
  );

  type SectionInput = SiteConfigInput["sections"][number];
  const sections: SectionInput[] = [
    {
      id: "hero",
      enabled: true,
      content: {
        title: business.name?.trim() || "Seu negócio",
        subtitle: business.description?.trim()
          ? sentence(business.description).slice(0, 200)
          : undefined,
        image: image(heroPhoto),
        cta,
      },
    },
  ];
  const push = (id: SectionId, enabled: boolean, sectionContent: unknown) =>
    sections.push({
      id,
      enabled: wanted.has(id) && enabled,
      content: sectionContent,
    } as SectionInput);
  push("sobre", aboutText.length > 0, {
    title: "Quem somos",
    text: aboutText,
    image: image(aboutPhoto),
  });
  push("servicos", services.length > 0, {
    title: "Serviços",
    items: services.map((item, index) => ({
      name: item.name?.trim() ?? "",
      description: item.description?.trim() || undefined,
      price: item.price?.trim() || undefined,
      icon: icons[index % icons.length],
    })),
  });
  push("diferenciais", highlights.length >= 3, {
    title: "Por que nos escolher",
    items: highlights.map((item, index) => ({
      title: item.title?.trim() ?? "",
      text: item.text?.trim() || undefined,
      icon: icons[(index + 3) % icons.length],
    })),
  });
  push("galeria", gallery.length > 0, {
    title: "Fotos",
    images: gallery.map((photo) => image(photo)),
  });
  push("depoimentos", testimonials.length > 0 && category !== "psicologia", {
    title: "Quem já veio",
    items: testimonials.map((item) => ({
      name: item.name?.trim() ?? "",
      context: item.context?.trim() || undefined,
      text: item.text?.trim() ?? "",
      authorized: true as const,
    })),
  });
  push("faq", faq.length > 0, {
    title: "Perguntas frequentes",
    items: faq.map((item) => ({
      question: item.question?.trim() ?? "",
      answer: item.answer?.trim() ?? "",
    })),
  });
  push("cta-final", true, { title: "Vamos conversar?", cta });
  push("contato", true, {
    title: "Contato",
    showHours: hours.mode !== "byAppointment" || Boolean(hours.note),
    showMapLink: fixed,
  });

  const identity = options.identity ?? null;
  return {
    schemaVersion: "1.2",
    site: {
      type: "landing-page",
      language: "pt-BR",
      timezone: "America/Sao_Paulo",
      subdomain: draft.site?.subdomain ?? "rascunho-site",
      customDomain: null,
    },
    business: {
      name: business.name?.trim() ?? "",
      category,
      family,
      description: business.description?.trim() ?? "",
      foundedYear: business.foundedYear,
      contact: {
        whatsapp: contact.whatsapp || undefined,
        phone: contact.phone || undefined,
        email: contact.email || undefined,
      },
      address: {
        hasFixedAddress: fixed,
        street: fixed ? contact.street : undefined,
        number: fixed ? contact.number || undefined : undefined,
        district: contact.district || undefined,
        city: business.city?.trim() ?? "",
        state: business.state as SiteConfigInput["business"]["address"]["state"],
        zip: fixed ? contact.zip || undefined : undefined,
      },
      serviceArea: fixed ? [] : (contact.serviceArea ?? []),
      openingHours: hours,
      social: {
        instagram: contact.instagram || undefined,
        facebook: contact.facebook || undefined,
      },
      registration: contact.registration,
    },
    brand: {
      logoAsset: has(brand.logoAsset) ? brand.logoAsset : null,
      brandColors: brand.brandColors ?? [],
      feelings: brand.feelings ?? [],
    },
    design: {
      seed: options.seed ?? "rascunho",
      round: options.round ?? 0,
      identity,
      directionStatus: options.approvedDirectionId && identity ? "approved" : "draft",
      approvedDirectionId:
        options.approvedDirectionId && identity ? options.approvedDirectionId : null,
      lockedFields:
        options.approvedDirectionId && identity
          ? [
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
            ]
          : [],
      overrides: {},
    },
    sections,
    navigation: { sticky: true, ctaLabel: cta.label },
    seo: {
      title:
        `${business.name?.trim() ?? ""} | ${categoryInfo(category)?.label ?? "Negócio"} em ${business.city?.trim() ?? ""}`.slice(
          0,
          70,
        ),
      description: (business.description?.trim() ?? "").slice(0, 160),
      keywords: [],
    },
    integrations: { whatsappFloatingButton: Boolean(contact.whatsapp) },
    ai: {
      tone: null,
      generatedFields: [],
      userEditedFields: [],
      promptVersion: null,
      playbookVersion: null,
      modelId: null,
    },
    review: { status: "notReviewed", reviewerReportId: null, humanDecision: null },
  };
}
