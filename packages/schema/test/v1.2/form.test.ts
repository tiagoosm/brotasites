import { describe, expect, it } from "vitest";
import {
  blockedTopic,
  categoryNotOpen,
  contactAnswersSchema,
  contentAnswersSchema,
  type FormDraft,
  formToSiteConfig,
  missingToGenerate,
  sectionsOf,
  siteConfigSchema,
} from "../../src/v1.2/index.js";

const photo = (n: number, extra: object = {}) => ({
  assetId: `0b6f2a4e-5c1d-4e8a-9f3b-2d7c6a1e4b9${n}`,
  alt: `Foto ${n}`,
  ...extra,
});

const padaria: FormDraft = {
  business: {
    name: "Padaria do Zé",
    category: "padaria",
    city: "Santa Rita do Sapucaí",
    state: "MG",
    description: "Padaria de bairro com pães de fermentação natural desde 1998",
    foundedYear: 1998,
    story: { origin: "O Zé começou vendendo pão na porta de casa", bestseller: "Pão de queijo" },
  },
  brand: { logoAsset: null, brandColors: ["#B45309"], feelings: ["acolhedor"] },
  content: {
    services: [
      { name: "Pães artesanais", description: "Feitos todas as manhãs", price: "R$ 12,90" },
    ],
    faq: [{ question: "Fazem encomendas?", answer: "Sim, com 2 dias de antecedência." }],
    photos: [photo(1, { use: "hero" }), photo(2), photo(3, { showsMinor: true })],
  },
  contact: {
    whatsapp: "5535999990000",
    hasFixedAddress: true,
    street: "Rua das Flores",
    number: "123",
    district: "Centro",
    serviceArea: [],
    openingHours: {
      mode: "schedule",
      rules: [{ days: ["mon", "tue"], intervals: [{ open: "06:00", close: "19:00" }] }],
    },
  },
};

describe("formToSiteConfig", () => {
  it("turns the answers into a valid 1.2 config with the client's own words", () => {
    const parsed = siteConfigSchema.safeParse(formToSiteConfig(padaria));
    expect(parsed.success, parsed.error?.message).toBe(true);
    const config = parsed.data;
    const sobre = config?.sections.find((s) => s.id === "sobre");
    expect(sobre?.id === "sobre" && sobre.content.text).toBe(
      "Padaria de bairro com pães de fermentação natural desde 1998. O Zé começou vendendo pão na porta de casa. Pão de queijo.",
    );
    const hero = config?.sections[0];
    expect(hero?.id === "hero" && hero.content.cta).toEqual({
      label: "Chamar no WhatsApp",
      action: "whatsapp",
    });
    expect(hero?.id === "hero" && hero.content.image?.assetId).toBe(photo(1).assetId);
  });

  it("leaves out photos of minors without consent and turns off sections without content", () => {
    const config = siteConfigSchema.parse(
      formToSiteConfig({
        ...padaria,
        sections: ["sobre", "servicos", "galeria", "depoimentos", "diferenciais", "contato"],
      }),
    );
    const gallery = config.sections.find((s) => s.id === "galeria");
    expect(gallery?.id === "galeria" && gallery.content.images.map((i) => i.assetId)).toEqual([
      photo(2).assetId,
    ]);
    expect(config.sections.find((s) => s.id === "depoimentos")?.enabled).toBe(false);
    expect(config.sections.find((s) => s.id === "diferenciais")?.enabled).toBe(false);
    expect(config.sections.find((s) => s.id === "faq")?.enabled).toBe(false);
  });

  it("uses the next channel when there is no WhatsApp, and the service area without an address", () => {
    const config = siteConfigSchema.parse(
      formToSiteConfig({
        ...padaria,
        contact: {
          phone: "3535550000",
          hasFixedAddress: false,
          serviceArea: ["Centro"],
          openingHours: { mode: "always", rules: [] },
        },
      }),
    );
    expect(config.sections[0]?.id === "hero" && config.sections[0].content.cta?.action).toBe(
      "phone",
    );
    expect(config.business.serviceArea).toEqual(["Centro"]);
    expect(config.business.address.street).toBeUndefined();
  });

  it("keeps only the assets that exist", () => {
    const config = siteConfigSchema.parse(
      formToSiteConfig(padaria, { availableAssets: new Set([photo(2).assetId]) }),
    );
    expect(config.sections[0]?.id === "hero" && config.sections[0].content.image).toBeNull();
  });
});

describe("form checks", () => {
  it("lists what is missing to generate", () => {
    expect(missingToGenerate(padaria)).toEqual([]);
    expect(missingToGenerate({ business: { name: "X", description: "curta" } })).toEqual([
      "o tipo de negócio",
      "a cidade e o estado",
      "um contato (WhatsApp, telefone ou e-mail)",
      "um serviço ou uma descrição com pelo menos 60 caracteres",
    ]);
  });

  it("refuses blocked topics and categories not open yet", () => {
    expect(blockedTopic("Loja do Beto", "Vendemos vapes e pods descartáveis")).toBe(
      "cigarro eletrônico e tabaco",
    );
    expect(blockedTopic("Padaria", "Pão quente")).toBeNull();
    expect(categoryNotOpen("padaria")).toBeNull();
  });

  it("suggests the family's sections until the client chooses", () => {
    expect(sectionsOf({ business: { category: "padaria" } })).toEqual([
      "servicos",
      "galeria",
      "contato",
      "cta-final",
    ]);
    expect(sectionsOf({ sections: ["hero", "faq"] })).toEqual(["faq"]);
  });

  it("validates contact and photo consent", () => {
    expect(
      contactAnswersSchema.safeParse({
        hasFixedAddress: false,
        serviceArea: [],
        openingHours: { mode: "always", rules: [] },
      }).success,
    ).toBe(false);
    const content = contentAnswersSchema.safeParse({
      services: [],
      highlights: [],
      faq: [],
      testimonials: [],
      photos: [photo(1, { showsPeople: true })],
    });
    expect(content.error?.issues[0]?.message).toBe(
      "Confirme que as pessoas da foto autorizaram o uso.",
    );
  });
});
