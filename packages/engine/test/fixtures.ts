import type { Variant } from "@brotasites/catalog";
import { personalities } from "@brotasites/catalog";
import type { EngineInput } from "../src/index.js";

// Stand-in variants until the factory (E6) ships real ones, and 30 fictional businesses:
// 10 per family of this round (food, beauty, events and creatives).

const families = ["food", "beauty", "events-creative"] as const;
const all = [...personalities];

export const fixtureVariants: Variant[] = [
  {
    id: "hero-giant-strip",
    section: "hero",
    families,
    personalities: all,
    requires: { photo: "required" },
    version: 1,
  },
  {
    id: "hero-two-columns",
    section: "hero",
    families,
    personalities: ["acolhedor", "elegante", "robusto"],
    requires: { photo: "optional" },
    version: 1,
  },
  {
    id: "hero-full-photo",
    section: "hero",
    families,
    personalities: ["elegante", "robusto", "moderno"],
    requires: { photo: "required", goodPhoto: true },
    version: 1,
  },
  {
    id: "hero-type-gradient",
    section: "hero",
    families,
    personalities: all,
    requires: { photo: "none" },
    version: 1,
  },
  {
    id: "hero-bento",
    section: "hero",
    families,
    personalities: ["moderno", "ousado"],
    requires: { photo: "optional" },
    version: 1,
  },
  {
    id: "hero-asymmetric",
    section: "hero",
    families,
    personalities: ["elegante", "moderno", "ousado", "robusto"],
    requires: { photo: "none" },
    version: 1,
  },
  ...(
    [
      "sobre",
      "servicos",
      "como-funciona",
      "diferenciais",
      "galeria",
      "depoimentos",
      "faq",
      "cta-final",
      "contato",
    ] as const
  ).flatMap((section) =>
    [
      { suffix: "a", personalities: ["acolhedor", "elegante"] as const },
      { suffix: "b", personalities: ["moderno", "robusto"] as const },
      { suffix: "c", personalities: ["ousado", "acolhedor", "moderno"] as const },
    ].map(
      ({ suffix, personalities: suits }): Variant => ({
        id: `${section}-${suffix}`,
        section,
        families: "all",
        personalities: [...suits],
        requires: { photo: section === "galeria" ? "required" : "optional" },
        version: 1,
      }),
    ),
  ),
];

type Business = Omit<EngineInput, "round">;

const base = (
  family: EngineInput["family"],
  category: string,
  name: string,
  city: string,
  extra: Partial<Business> = {},
): Business => ({
  name,
  city,
  category,
  family,
  feelings: [],
  brandColors: [],
  hasLogo: false,
  photos: "good",
  ...extra,
});

export const businesses: Business[] = [
  base("food", "padaria", "Padaria do Zé", "Santa Rita do Sapucaí", {
    brandColors: ["#B45309", "#78350F"],
    feelings: ["acolhedor"],
    hasLogo: true,
  }),
  base("food", "confeitaria", "Doce Lar Confeitaria", "Pouso Alegre", {
    feelings: ["acolhedor", "elegante"],
  }),
  base("food", "marmitaria", "Marmitas da Cida", "Itajubá", { photos: "weak" }),
  base("food", "cafeteria", "Café Grão Mineiro", "Varginha", {
    brandColors: ["#3F2A1E"],
    feelings: ["elegante"],
  }),
  base("food", "acai-sorveteria", "Açaí Tropical", "Campinas", {
    feelings: ["ousado"],
    brandColors: ["#6B21A8"],
  }),
  base("food", "food-truck", "Truck do Beto", "Belo Horizonte", {
    feelings: ["ousado", "moderno"],
    photos: "none",
  }),
  base("food", "lanchonete", "Lanche Bom", "Lavras", { feelings: ["robusto"] }),
  base("food", "pizzaria", "Pizzaria Forno a Lenha", "Poços de Caldas", {
    brandColors: ["#DC2626", "#16A34A"],
  }),
  base("food", "restaurante", "Restaurante Sabor da Serra", "Monte Verde", {
    feelings: ["acolhedor"],
    photos: "weak",
  }),
  base("food", "hortifruti-acougue", "Hortifruti Boa Safra", "Três Corações", {
    brandColors: ["#15803D"],
    feelings: ["moderno"],
  }),
  base("beauty", "salao-beleza", "Studio Bella", "São Paulo", {
    feelings: ["elegante"],
    brandColors: ["#BE185D"],
  }),
  base("beauty", "barbearia", "Barbearia do Tonho", "Curitiba", {
    feelings: ["robusto"],
    hasLogo: true,
  }),
  base("beauty", "manicure", "Unhas da Jé", "Pouso Alegre", {
    feelings: ["acolhedor", "ousado"],
    photos: "none",
  }),
  base("beauty", "sobrancelha-cilios", "Olhar Design de Sobrancelhas", "Itajubá", {
    feelings: ["elegante", "moderno"],
  }),
  base("beauty", "maquiadora", "Make by Lia", "Rio de Janeiro", { feelings: ["ousado"] }),
  base("beauty", "estetica", "Clínica Pele Leve", "Belo Horizonte", { brandColors: ["#0F766E"] }),
  base("beauty", "massagem-spa", "Spa Recanto", "Campos do Jordão", {
    feelings: ["acolhedor"],
    photos: "weak",
  }),
  base("beauty", "depilacao", "Depil Express", "Varginha", { feelings: ["moderno"] }),
  base("beauty", "tatuagem-piercing", "Tinta Preta Tattoo", "Porto Alegre", {
    feelings: ["robusto", "ousado"],
    brandColors: ["#111111"],
  }),
  base("beauty", "barbearia", "Navalha de Ouro", "Santa Rita do Sapucaí", {
    feelings: ["elegante", "robusto"],
    brandColors: ["#CA8A04"],
  }),
  base("events-creative", "buffet-festas", "Buffet Alegria", "São Paulo", { feelings: ["ousado"] }),
  base("events-creative", "espaco-eventos", "Espaço Jardim das Flores", "Atibaia", {
    feelings: ["elegante"],
    brandColors: ["#166534"],
  }),
  base("events-creative", "dj-sonorizacao", "DJ Marquinhos", "Recife", {
    feelings: ["moderno", "ousado"],
    photos: "weak",
  }),
  base("events-creative", "decoracao-cerimonial", "Ateliê Laço de Fita", "Salvador", {
    feelings: ["acolhedor"],
  }),
  base("events-creative", "aluguel-festas", "Aluga Festa", "Goiânia", { photos: "none" }),
  base("events-creative", "salgados-doces-festa", "Salgadinhos da Vó Nena", "Fortaleza", {
    feelings: ["acolhedor", "ousado"],
    hasLogo: true,
  }),
  base("events-creative", "fotografo-eventos", "Clique Eterno Fotografia", "Florianópolis", {
    feelings: ["elegante"],
  }),
  base("events-creative", "artesanato-atelie", "Ateliê Mãos de Barro", "Tiradentes", {
    feelings: ["acolhedor"],
    brandColors: ["#9A3412"],
  }),
  base("events-creative", "estamparia", "Estampa Viva", "Belém", {
    feelings: ["ousado", "moderno"],
    brandColors: ["#2563EB", "#F59E0B"],
  }),
  base("events-creative", "pousada-chale", "Chalés Vale Verde", "Gonçalves", {
    feelings: ["acolhedor", "elegante"],
  }),
];
